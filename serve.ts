// Porto Alba — a tiny static server for local play and screenshots:
//
//   node serve.ts            # http://localhost:8080
//   node serve.ts --port 9000
//
// It serves game/ only, with a small MIME map and a guard against paths
// that escape the game directory. The game itself needs no build step.

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

function parsePort() {
  const flag = process.argv.indexOf('--port');
  if (flag === -1) return 8080;
  const value = Number(process.argv[flag + 1]);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`--port needs a number from 1 to 65535, got ${process.argv[flag + 1] ?? '(nothing)'}.`);
  }
  return value;
}

const PORT = parsePort();
const GAME_DIR = resolve(import.meta.dirname, 'game');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const decoded = decodeURIComponent(url.pathname);
  const rel = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const file = resolve(GAME_DIR, rel);
  if (!file.startsWith(GAME_DIR + '/') && file !== GAME_DIR) {
    res.writeHead(403, { 'content-type': 'text/plain' });
    res.end('forbidden');
    return;
  }
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Porto Alba at http://localhost:${PORT}/`);
});
