/* ============================================================
   Runs Docket's API handlers on any host.

   The handlers in api/ are written Node-style, `(req, res)`, which is
   what Vercel wants natively. Netlify and Cloudflare speak the Web
   standard instead: a Request in, a Response out.

   Rather than rewrite tested handlers for each platform, this adapts the
   runtime to them. It is the only per-platform code in Docket, and it is
   small enough to read in one sitting.

   Used by:
     netlify/functions/*.mjs     Netlify
     functions/api/*.js          Cloudflare Pages
   Vercel calls api/*.js directly and never comes through here.
   ============================================================ */

import { setEnvContext } from './env.mjs';

/** Header names arrive lowercased from the Web API, which is what the
 *  handlers already expect. */
function headersToObject(request) {
  const out = {};
  for (const [key, value] of request.headers) out[key.toLowerCase()] = value;
  return out;
}

/**
 * Some platforms put the true client IP on their own header rather than
 * the ones clientIp() trusts. Normalising here keeps that knowledge in
 * the adapter instead of leaking into the handlers.
 */
function normaliseClientIp(headers, extraIp) {
  if (headers['x-real-ip']) return headers;
  const candidate =
    extraIp ||
    headers['cf-connecting-ip'] ||       // Cloudflare
    headers['x-nf-client-connection-ip'] // Netlify
    || '';
  if (candidate) headers['x-real-ip'] = candidate;
  return headers;
}

/**
 * Invokes a Node-style handler with a Web Request, and resolves the
 * Response it produced.
 *
 * @param handler  the default export from api/submit.js or api/vote.js
 * @param request  a standard Request
 * @param options  { env } the runtime's environment object, if it has one
 *                 (Cloudflare), and { ip } if the platform supplies it
 *                 outside the headers
 */
export async function runNodeHandler(handler, request, { env, ip } = {}) {
  if (env) setEnvContext(env);

  const headers = normaliseClientIp(headersToObject(request), ip);

  let body = null;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    // Read as text so a malformed body reaches readJsonBody's own
    // error handling rather than throwing out here.
    body = await request.text().catch(() => null);
  }

  const req = { method: request.method, headers, body, url: request.url };

  return await new Promise((resolve) => {
    const outHeaders = { 'content-type': 'application/json' };
    let statusCode = 200;
    let settled = false;

    /* 204 and 304 are "null body" statuses: constructing a Response with any
       body at all, including an empty string, throws. A handler ending a 204
       with end('') is completely normal, so that has to be handled here. */
    const NULL_BODY = new Set([204, 304]);

    const send = (payload) => {
      if (settled) return res;

      // Build the Response BEFORE marking this settled. Marking first and
      // then throwing leaves the promise permanently unresolved, and the
      // catch below sees `settled` and declines to rescue it: the request
      // hangs forever rather than failing. That is exactly what a 204 used
      // to do here.
      let response;
      try {
        const body = NULL_BODY.has(statusCode)
          ? null
          : (typeof payload === 'string' ? payload : JSON.stringify(payload));
        response = new Response(body, { status: statusCode, headers: outHeaders });
      } catch (err) {
        console.error('could not build a response:', err);
        response = new Response(JSON.stringify({ ok: false, error: 'Something went wrong. Please try again shortly.' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        });
      }

      settled = true;
      resolve(response);
      return res;
    };

    const res = {
      setHeader(name, value) { outHeaders[String(name).toLowerCase()] = String(value); return res; },
      status(code) { statusCode = code; return res; },
      json(payload) { return send(payload); },
      send(payload) { return send(payload); },
      end(payload) { return send(payload ?? ''); },
    };

    Promise.resolve(handler(req, res)).catch((err) => {
      console.error('handler error:', err);
      if (!settled) {
        settled = true;
        resolve(new Response(JSON.stringify({ ok: false, error: 'Something went wrong. Please try again shortly.' }), {
          status: 502,
          headers: { 'content-type': 'application/json' },
        }));
      }
    });
  });
}
