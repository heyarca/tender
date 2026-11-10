import { createHash, randomBytes } from "node:crypto";

const BASE32 = "abcdefghijklmnopqrstuvwxyz234567";

/** `length` random base32 characters (5 bits each, from a CSPRNG). */
export function randomBase32(length: number): string {
  const bytes = randomBytes(Math.ceil((length * 5) / 8));
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5 && output.length < length) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  return output;
}

export const ACCOUNT_ID_PATTERN = /^acct_[a-z2-7]{24}$/;
export const API_KEY_PATTERN = /^tk_[a-z2-7]{32}$/;

export function newAccountId(): string {
  return `acct_${randomBase32(24)}`;
}

export function isAccountId(value: unknown): value is string {
  return typeof value === "string" && ACCOUNT_ID_PATTERN.test(value);
}

export function newApiKeySecret(): string {
  return `tk_${randomBase32(32)}`;
}

export function newApiKeyId(): string {
  return `key_${randomBase32(16)}`;
}

/** SHA-256 hex of an API key secret. Only the hash is stored. */
export function hashApiKey(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}
