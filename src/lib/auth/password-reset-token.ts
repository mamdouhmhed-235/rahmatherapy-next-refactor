// SERVER ONLY. Token generation + storage primitives for the password-reset
// flow. The plaintext token is emailed to the staff member; only its hash is
// persisted in `account_password_requests.encrypted_payload`.
//
// Storage encoding via `payload_cipher_version`:
//   0 — SHA-256 hash, no nonce, no encryption key. Verify-only equality.
//       This is the chosen scheme: hash is the right cryptographic primitive
//       when we never need to recover the original. Reduces the steal-the-DB
//       blast radius (no key to leak).
//   1+ — reserved for future migration to authenticated encryption if the
//       requirement ever shifts to "decrypt and reissue the token."

const TOKEN_BYTE_LENGTH = 32; // 256 bits → 64 hex chars.
export const CURRENT_CIPHER_VERSION = 0;

// Random URL-safe hex token. 256 bits of entropy is the OWASP recommendation
// for opaque session-equivalent tokens.
export function generateResetToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// SHA-256 hex digest of the plaintext token. The Node + Web Crypto APIs both
// expose `crypto.subtle.digest`, so this is dependency-free.
export async function hashResetToken(plaintext: string): Promise<string> {
  const data = new TextEncoder().encode(plaintext);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

interface VerifiableRow {
  encrypted_payload: string | null;
  payload_cipher_version: number;
}

// Constant-time string equality. Avoids the early-return timing leak from a
// naive `===` comparison on the hash hex strings.
function safeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function verifyResetToken(
  plaintext: string,
  row: VerifiableRow
): Promise<boolean> {
  if (!row.encrypted_payload) return false;
  if (row.payload_cipher_version === CURRENT_CIPHER_VERSION) {
    const candidate = await hashResetToken(plaintext);
    return safeEquals(candidate, row.encrypted_payload);
  }
  // Unknown cipher version — fail closed.
  return false;
}
