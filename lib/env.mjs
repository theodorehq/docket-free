/* ============================================================
   Environment access.

   Every host hands environment variables over differently. Node-based
   hosts (Vercel, Netlify, GitHub Actions, your laptop) put them on
   process.env. Cloudflare Workers do not have process.env at all: they
   pass an env object into the request handler.

   So nothing in Docket reads process.env directly. Everything goes
   through env() here, and each platform adapter calls setEnvContext()
   with whatever its runtime gave it.

   The context is a module-level value rather than a parameter threaded
   through every function. That is safe because it is the same for every
   request in a deployment: adapters set it to the same object each time,
   so concurrent requests cannot see a different one.
   ============================================================ */

let context = null;

/** Called by a platform adapter with that runtime's env object. */
export function setEnvContext(obj) {
  if (obj && typeof obj === 'object') context = obj;
}

/**
 * Reads a variable, preferring the adapter-supplied context and falling
 * back to process.env where it exists. Returns "" rather than undefined,
 * so callers can test truthiness without guarding for the type.
 */
export function env(name, fallback = '') {
  if (context && context[name] != null && context[name] !== '') return String(context[name]);
  if (typeof process !== 'undefined' && process?.env?.[name] != null && process.env[name] !== '') {
    return String(process.env[name]);
  }
  return fallback;
}

/** True when a variable is set to anything non-empty. */
export function hasEnv(name) {
  return env(name) !== '';
}
