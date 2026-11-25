import crypto from "crypto";

const TOLERANCE_SECONDS = 300; // 5 minutes

export function verifySignature(
  rawBody: Buffer,
  timestamp: string,
  signature: string,
  secret: string,
): { valid: boolean; reason?: string } {
  if (!rawBody || !Buffer.isBuffer(rawBody)) {
    return { valid: false, reason: "MISSING_BODY" };
  }

  const now = Math.floor(Date.now() / 1000);
  const ts = Number(timestamp);

  if (!ts || Math.abs(now - ts) > TOLERANCE_SECONDS) {
    return { valid: false, reason: "STALE_TIMESTAMP" };
  }

  const signedPayload = `${ts}.${rawBody.toString()}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  const sigBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (sigBuffer.length !== expectedBuffer.length) {
    return { valid: false, reason: "MALFORMED_SIGNATURE" };
  }

  const matches = crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  return matches
    ? { valid: true }
    : { valid: false, reason: "INVALID_SIGNATURE" };
}
