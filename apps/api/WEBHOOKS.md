# Webhooks

ShopCore receives events from two independent sources through two separate
routes, both of which must tolerate at-least-once delivery (a sender may
retry a request it already sent, e.g. after a timeout or a dropped
response). Both routes are therefore built to be safely re-run with the
same payload: receiving the same event twice must never apply its effect
twice.

## Routes

| Route                          | Source                          | Auth                                   |
|---------------------------------|----------------------------------|-----------------------------------------|
| `POST /api/v1/webhooks`         | Our own internal/test event feed | Custom HMAC-SHA256 signature            |
| `POST /api/v1/webhooks/stripe`  | Stripe (Checkout, payments)      | Stripe's signature (`stripe-signature`) |

Both are mounted with `express.raw({ type: "application/json" })` **before**
the global `express.json()` middleware, because signature verification needs
the exact raw request bytes — re-serializing a parsed JSON body would not
reproduce the same signature the sender computed.

## Signature verification

### Custom route (`/api/v1/webhooks`)

- The sender signs `${timestamp}.${rawBody}` with HMAC-SHA256 using a shared
  secret (`WEBHOOK_SIGNING_SECRET`), sent as `X-Signature` / `X-Timestamp`
  headers.
- We recompute the signature from the raw body and compare it using
  `crypto.timingSafeEqual` (not `===`), to avoid leaking timing information
  that could help an attacker guess a valid signature byte-by-byte.
- We reject requests whose timestamp is older than a configured tolerance
  window (`STALE_TIMESTAMP`), to limit the window in which a captured
  request could be replayed.
- We reject requests with a missing/non-buffer body up front
  (`MISSING_BODY`), which also protects `verifySignature` itself from being
  called with no data to hash.

### Stripe route (`/api/v1/webhooks/stripe`)

- Stripe signs the raw body with a per-endpoint secret
  (`STRIPE_WEBHOOK_SECRET`, obtained from `stripe listen` locally or the
  Stripe Dashboard in production).
- We verify it with the SDK's own `stripe.webhooks.constructEvent`, which
  does the HMAC comparison and timestamp-tolerance check for us.
- An invalid signature returns `400 INVALID_SIGNATURE` without touching the
  database.

## Idempotent processing

Both routes funnel verified events into the same `processEvent(eventId,
payload)` function (`src/modules/webhooks/service.ts`), which is the single
place that actually applies side effects.

The idempotency guarantee comes from the database, not from application
logic:

1. `WebhookEvent.id` has a **unique constraint**, and `eventId` (our custom
   route's own id, or Stripe's `event.id`) is used directly as that primary
   key.
2. `processEvent` wraps the `WebhookEvent` insert and any side effect (e.g.
   updating an `Order`'s status) in a single `prisma.$transaction`.
3. If the insert violates the unique constraint (Prisma error code `P2002`),
   we catch it and return `{ duplicate: true }` instead of throwing — the
   side effect inside that transaction is rolled back along with the
   failed insert, so a duplicate delivery can never apply its effect twice,
   even when two copies of the same event arrive at the same time.

This makes the guarantee correct under concurrency: if two requests for the
same `eventId` race each other, the database — not a check-then-act
race in our own code — decides exactly one of them wins the insert.
Covered by `tests/integration/webhooks.test.ts`:
`handles concurrent duplicate deliveries without double-processing`.

## Stripe-specific mapping

`src/modules/webhooks/stripeController.ts` only acts on
`checkout.session.completed` events (other event types, like
`payment_intent.created`, are acknowledged with `200` but ignored, since
Stripe will keep retrying any webhook that doesn't return `2xx`). On a
completed checkout session, it reads `session.metadata.orderId` (set when
we created the Checkout Session in `orders/service.ts`) and calls
`processEvent` with a payload that updates that order's status to `PAID`.

Orders are created with `status: PENDING` (the schema default) and only
move to `PAID` once this webhook actually confirms payment — checkout
succeeding does not by itself mean the order is paid.

## Local testing

```bash
# Terminal 1
pnpm dev

# Terminal 2 — forwards real Stripe test-mode events to your local server
stripe listen --forward-to localhost:4000/api/v1/webhooks/stripe
# copy the printed whsec_... into .env as STRIPE_WEBHOOK_SECRET, then
# restart `pnpm dev` so it picks up the new value

# Terminal 3 — trigger a real checkout
curl -s -X POST localhost:4000/api/v1/orders/checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"items":[{"productId":"...","quantity":1}]}'
# open the returned checkoutUrl in a browser and pay with 4242 4242 4242 4242
```
