// AES-256-GCM unwrap for client-supplied API keys (decrypt-only on the
// trigger side — keys are encrypted by the web app's /settings flow).
// See apps/web/lib/encryption.ts for the matching encrypt path.

import { createDecipheriv } from "node:crypto";

const ALG = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function loadKey(): Buffer {
  const raw = process.env.MASTER_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("MASTER_ENCRYPTION_KEY env var not set");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `MASTER_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length})`,
    );
  }
  return key;
}

export function decryptSecret(ciphertextB64: string): string {
  const key = loadKey();
  const buf = Buffer.from(ciphertextB64, "base64");
  if (buf.length < IV_LEN + TAG_LEN) {
    throw new Error("decryptSecret: ciphertext too short");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}
