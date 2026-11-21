import http from 'node:http';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
function option(flag, fallback) {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}
const host = option('--host', '127.0.0.1');
const port = Number(option('--port', process.env.PORT || '4173'));
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Port không hợp lệ.');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};
function plain(response, code, message) {
  response.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(message);
}
const server = http.createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') return plain(response, 405, 'Method not allowed');
  try {
    const url = new URL(request.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.includes('\0') || pathname.split('/').some((part) => part.startsWith('.'))) {
      return plain(response, 403, 'Forbidden');
    }
    let target = path.resolve(root, `.${pathname}`);
    if (target !== root && !target.startsWith(root + path.sep)) return plain(response, 403, 'Forbidden');
    let stat = await fs.stat(target);
    if (stat.isDirectory()) { target = path.join(target, 'index.html'); stat = await fs.stat(target); }
    const real = await fs.realpath(target);
    if (!real.startsWith(root + path.sep) || !stat.isFile()) return plain(response, 403, 'Forbidden');
    const headers = {
      'Content-Type': types[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Accept-Ranges': 'bytes',
    };
    if (url.pathname === '/sw.js') headers['Service-Worker-Allowed'] = '/';
    let start = 0;
    let end = stat.size - 1;
    let status = 200;
    if (request.headers.range) {
      const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
      if (!range) return plain(response, 416, 'Range not satisfiable');
      start = range[1] ? Number(range[1]) : Math.max(0, stat.size - Number(range[2]));
      end = range[1] && range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
      if (start > end || start >= stat.size) {
        response.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
        response.end();
        return;
      }
      status = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
    }
    headers['Content-Length'] = String(Math.max(0, end - start + 1));
    response.writeHead(status, headers);
    if (request.method === 'HEAD' || stat.size === 0) return response.end();
    createReadStream(target, { start, end }).on('error', () => response.destroy()).pipe(response);
  } catch (error) {
    plain(response, error.code === 'ENOENT' ? 404 : 400, error.code === 'ENOENT' ? 'Không tìm thấy tệp.' : 'Yêu cầu không hợp lệ.');
  }
});
server.listen(port, host, () => console.log(`Hành Gừng Tỏi: http://${host}:${port}`));
