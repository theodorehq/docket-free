/* ============================================================
   Submitter email addresses, encrypted at rest.

   WHY THIS EXISTS

   Support items are Markdown files in a git repository, and git history
   is permanent. Deleting a file does not remove what was committed. If a
   readable email address is ever written to the repo, honouring a
   deletion request means rewriting history: hard, disruptive, and it
   breaks every existing clone.

   So no readable address is ever written. The stored value is ciphertext
   the site owner can decrypt with a key held in their environment, which
   makes an erasure request a normal edit. Destroying the key renders
   every historic value meaningless.

   This substantially reduces exposure. Whether it satisfies any specific
   legal obligation is the site owner's question, not a claim Docket
   makes. See LEGAL-CHECKLIST.md.

   HOW

   AES-256-GCM from node:crypto. No dependencies, same as the rest of the
   engine. Random IV per value, authentication tag included, so tampering
   is detected rather than silently decrypting to nonsense.

   Stored form:  enc.v1.<base64url( iv | tag | ciphertext )>

   The prefix is deliberate. It makes the value self-describing, lets a
   future scheme coexist with this one, and means a plain address can
   still be read (see decryptEmail) so an existing archive keeps working.
   ============================================================ */

import { env } from './env.mjs';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';

const PREFIX = 'enc.v1.';
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** The key comes from the environment and never from config, because
 *  config is committed and this must not be. Accepts base64 or hex, or
 *  any passphrase, which is hashed to the required 32 bytes. */
function keyBytes() {
  const raw = env('EMAIL_ENCRYPTION_KEY', '');
  if (!raw) return null;
  for (const enc of ['base64', 'hex']) {
    try {
      const buf = Buffer.from(raw, enc);
      if (buf.length === 32) return buf;
    } catch { /* try the next encoding */ }
  }
  // Anything else is treated as a passphrase rather than rejected, so a
  // buyer who pastes a random string still gets a valid key.
  return createHash('sha256').update(raw, 'utf8').digest();
}

/** True when email storage is available. When false, submissions still
 *  work; those items simply carry no address and cannot be emailed. */
export function emailEncryptionAvailable() {
  return keyBytes() !== null;
}

/** True for a value already in stored form. */
export function isEncryptedEmail(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

/**
 * Returns the stored form, or "" when there is no address or no key.
 * Never returns a readable address, and never throws: a failure here
 * must not cost a customer their submission.
 */
export function encryptEmail(plain) {
  const address = typeof plain === 'string' ? plain.trim() : '';
  if (!address) return '';
  if (isEncryptedEmail(address)) return address;

  const key = keyBytes();
  if (!key) return '';

  try {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const body = Buffer.concat([cipher.update(address, 'utf8'), cipher.final()]);
    return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
  } catch {
    return '';
  }
}

/**
 * Returns the readable address, or "" when it cannot be recovered.
 *
 * A value with no prefix is returned as-is. That is what lets an archive
 * written before encryption keep working, and it is the tolerant-reading
 * rule: never crash on a shape you did not expect.
 */
export function decryptEmail(stored) {
  const value = typeof stored === 'string' ? stored.trim() : '';
  if (!value) return '';
  if (!isEncryptedEmail(value)) return value;

  const key = keyBytes();
  if (!key) return '';

  try {
    const buf = Buffer.from(value.slice(PREFIX.length), 'base64url');
    if (buf.length <= IV_BYTES + TAG_BYTES) return '';
    const decipher = createDecipheriv('aes-256-gcm', key, buf.subarray(0, IV_BYTES));
    decipher.setAuthTag(buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    return Buffer.concat([
      decipher.update(buf.subarray(IV_BYTES + TAG_BYTES)),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    // Wrong key, or the value was altered. Either way there is no address
    // to be had, and the caller treats that as "cannot email this person".
    return '';
  }
}
