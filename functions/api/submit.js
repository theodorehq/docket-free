/* Cloudflare Pages adapter.
   Workers have no process.env, so the runtime's env object is passed
   through to lib/env.mjs. See lib/web-adapter.mjs. */
import handler from '../../api/submit.js';
import { runNodeHandler } from '../../lib/web-adapter.mjs';

export async function onRequestPost(context) {
  return runNodeHandler(handler, context.request, { env: context.env });
}
