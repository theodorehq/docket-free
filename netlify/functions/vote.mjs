/* Netlify adapter. See netlify/functions/submit.mjs. */
import handler from '../../api/vote.js';
import { runNodeHandler } from '../../lib/web-adapter.mjs';

export default async (request) => runNodeHandler(handler, request);

export const config = { path: '/api/vote' };
