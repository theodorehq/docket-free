/* Netlify adapter. Netlify Functions v2 speak the Web standard, and the
   real work lives in api/submit.js. See lib/web-adapter.mjs. */
import handler from '../../api/submit.js';
import { runNodeHandler } from '../../lib/web-adapter.mjs';

export default async (request) => runNodeHandler(handler, request);

export const config = { path: '/api/submit' };
