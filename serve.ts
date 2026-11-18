// Porto Alba — tiny static file server for local testing (Node stdlib only).
// Serves game/ on http://localhost:8080 by default:
//   node serve.ts            (port 8080)
//   PORT=8123 node serve.ts  (port 8123)
// Refuses any path that would escape game/.

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, normalize, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(join(here, 'game'));
const port = Number(process.env.PORT || 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = createServer((req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/index.html';
    const file = resolve(join(root, normalize(rel)));
    if (!file.startsWith(root + '/') && file !== root) {
      res.writeHead(403, { 'content-type': 'text/plain' });
      res.end('forbidden\n');
      return;
    }
    if (!existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found\n');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('server error\n');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Porto Alba serving game/ at http://127.0.0.1:${port}/`);
});
