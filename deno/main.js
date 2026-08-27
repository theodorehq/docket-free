/* Deno Deploy adapter.

   Deno Deploy has no build step and no separate functions directory: one
   entry point serves everything. So this does the two jobs the other
   hosts split between a static CDN and a functions runtime, which is why
   it is longer than netlify/functions/submit.mjs.

   The handlers themselves are untouched. `runNodeHandler` turns a Web
   Request into what api/submit.js expects, exactly as Netlify and
   Cloudflare do. See lib/web-adapter.mjs.

   Deploy: point Deno Deploy at this file as the entry point, with the
   build command `npm run build`. See docs/hosting.md. */

import { serveDir } from 'jsr:@std/http@1/file-server';
import submit from '../api/submit.js';
import vote from '../api/vote.js';
import { runNodeHandler } from '../lib/web-adapter.mjs';
import { setEnvContext } from '../lib/env.mjs';

/* Deno has no process.env, so hand it the runtime's own object once.
   Same contract Cloudflare uses. */
setEnvContext(Deno.env.toObject());

const ROOT = new URL('../dist/', import.meta.url).pathname;

const ROUTES = {
  '/api/submit': submit,
  '/api/vote': vote,
};

Deno.serve(async (request) => {
  const { pathname } = new URL(request.url);

  const handler = ROUTES[pathname.replace(/\/$/, '')];
  if (handler) {
    /* Deno Deploy puts the caller's address in this header; the rate
       limiter needs it and there is no connection object to read. */
    const ip = request.headers.get('x-forwarded-for') || '';
    return runNodeHandler(handler, request, { ip });
  }

  return serveDir(request, { fsRoot: ROOT, quiet: true });
});
