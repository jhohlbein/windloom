import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json'
};
http
  .createServer(async (req, res) => {
    try {
      const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (name.split('/').some((p) => p.startsWith('.')) || name.includes('node_modules'))
        throw Error();
      let file = path.resolve(root, '.' + name);
      if (file !== root && !file.startsWith(root + path.sep)) throw Error();
      if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
      res.writeHead(200, {
        'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  })
  .listen(8000, '127.0.0.1');
