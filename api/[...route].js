import { createApiHandler } from '../server/index.mjs';

const handler = createApiHandler();

export default async function vercelCatchAll(req, res) {
  return handler(req, res);
}
