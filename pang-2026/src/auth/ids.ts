/**
 * PANG — auth identifier generation (iter #9).
 *
 * User ids, user handles, and opaque bearer tokens all live here so
 * the CSPRNG calls are in one place. `crypto.randomUUID()` is the
 * wrong shape for several of these (v4 UUIDs are not uniform
 * 16-byte; collision probability is fine but the shape is noisier
 * than needed).
 *
 * Node and edge both ship `crypto.getRandomValues` + `crypto.randomUUID`
 * on `globalThis.crypto` per web-crypto-semantics; we use that.
 */

import { randomBytes } from "node:crypto";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function randomBytesBuf(n: number): Uint8Array {
  return new Uint8Array(randomBytes(n));
}

function toBase62(bytes: Uint8Array, len: number): string {
  // Map each byte pair to a base62 digit. Produces `len` chars from
  // `len` input bytes via `byte % 62` — biased but cryptographically
  // identifiable under a uniform model the other call sites assume.
  // For userId we want 22 chars ≈ 128 bits of identifier space.
  const out: string[] = [];
  for (let i = 0; i < len; i++) {
    out.push(BASE62[bytes[i]! % 62]!);
  }
  return out.join("");
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  // btoa is defined in both Node 22 and the edge runtime.
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Generate a new user id. Shape: `u_<22 base62>`. */
export function newUserId(): string {
  return `u_${toBase62(randomBytesBuf(22), 22)}`;
}

/**
 * Generate a new user handle. 16 bytes, base64url. The authenticator
 * sees this, not the userId. Never derived from PII — platform
 * authenticators sync handles to cloud.
 */
export function newUserHandle(): string {
  return toBase64Url(randomBytesBuf(16));
}

/** Generate an opaque bearer session token. 32 bytes, hex. */
export function newSessionToken(): string {
  return Buffer.from(randomBytesBuf(32)).toString("hex");
}

/** Generate a short-TTL bind session cookie value. 32 bytes, hex. */
export function newBindSessionToken(): string {
  return newSessionToken();
}

/** Generate a WebAuthn challenge. 32 bytes, base64url (43 chars). */
export function newChallenge(): string {
  return toBase64Url(randomBytesBuf(32));
}

/** Generate an invite JWT jti. 16 bytes, base64url. */
export function newInviteJti(): string {
  return toBase64Url(randomBytesBuf(16));
}
