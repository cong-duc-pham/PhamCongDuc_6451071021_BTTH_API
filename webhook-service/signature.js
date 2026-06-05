const crypto = require("crypto");

function verifyFacebookSignature(rawBody, signatureHeader, appSecret) {
  if (!appSecret) return { ok: false, reason: "missing_app_secret" };
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return { ok: false, reason: "missing_or_invalid_signature_header" };
  }

  const expected = `sha256=${crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex")}`;

  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(signatureHeader, "utf8");
  if (expectedBuffer.length !== receivedBuffer.length) {
    return { ok: false, reason: "signature_length_mismatch" };
  }

  return {
    ok: crypto.timingSafeEqual(expectedBuffer, receivedBuffer),
    reason: "signature_mismatch"
  };
}

module.exports = {
  verifyFacebookSignature
};
