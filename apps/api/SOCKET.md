# Real-Time Notifications (Socket.IO)

ShopCore pushes order-status changes to the owning user in real time over
Socket.IO, attached to the same HTTP server as the Express API
(`src/server.ts`).

## Identity comes from the token, never from the client

On connection, `initSocket`'s auth middleware
(`src/modules/notifications/socket.ts`) requires a JWT in
`socket.handshake.auth.token` — the same token issued by the Phase 1 auth
module. It verifies that token with `jwt.verify` and takes the user id from
the verified payload (`payload.sub`):

```typescript
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("UNAUTHORIZED"));

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
    socket.data.userId = payload.sub;
    next();
  } catch {
    next(new Error("UNAUTHORIZED"));
  }
});
```

A connection with no token, or a token that fails verification, is rejected
before `connection` ever fires — the client gets a `connect_error` with
message `"UNAUTHORIZED"`.

Nothing the client sends after this point — not a room name, not a user id
in a message payload — is ever trusted to determine identity. The only
identity a socket has for its entire lifetime is `socket.data.userId`, set
once from the verified token.

## Rooms are private per user, derived server-side

On `connection`, the server itself joins the socket to a room named from the
verified identity:

```typescript
const room = `user:${socket.data.userId}`;
socket.join(room);
```

The client never requests a room, never chooses a room name, and has no API
to join anyone else's room. `emitOrderUpdate(userId, event)` always targets
`user:${userId}` directly — there is no "broadcast to everyone" path for
order updates, so one user's events are structurally unreachable from
another user's socket.

This is covered by `tests/integration/socket.test.ts`:
`delivers events only to the target user's own room` connects two
authenticated sockets (`user-a`, `user-b`), emits an update for `user-a`
only, and asserts `user-b` received nothing.

## Where updates come from

`emitOrderUpdate` is called from two places, both after their respective
database transaction has committed (never from inside one, since a
rollback must not have already notified the client of a change that didn't
happen):

- `orders/service.ts`'s `checkout()` — emits once the order is created
  (`status: PENDING`).
- `webhooks/service.ts`'s `processEvent()` — emits once a webhook (custom
  HMAC or Stripe) has actually updated an order's status (e.g. to `PAID`),
  using the `userId` from the just-updated `Order` row, not from the
  webhook payload itself.

## Local testing

```bash
pnpm dev
```

Then, from a Node REPL or small script using `socket.io-client`:

```javascript
const { io } = require("socket.io-client");
const jwt = require("jsonwebtoken"); // only to mint a test token locally

const token = "...";          // a real token from /auth/login
const socket = io("http://localhost:4000", { auth: { token } });

socket.on("connect", () => console.log("connected"));
socket.on("order:update", (event) => console.log("order:update", event));
socket.on("connect_error", (err) => console.log("rejected:", err.message));
```

Trigger a checkout and complete payment (see `WEBHOOKS.md`) while this is
connected, and you should see two `order:update` events arrive: one for
`PENDING` at checkout, one for `PAID` once the webhook fires.
