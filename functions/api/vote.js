/* Cloudflare Pages adapter. See functions/api/submit.js. */
import handler from '../../api/vote.js';
import { runNodeHandler } from '../../lib/web-adapter.mjs';

export async function onRequestPost(context) {
  return runNodeHandler(handler, context.request, { env: context.env });
}
