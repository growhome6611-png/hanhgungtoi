import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFile(path.join(root, name), 'utf8');
const [template, css, app, search, storage, rawBook] = await Promise.all([
  read('index.html'), read('styles.css'), read('app.js'), read('lib/search.mjs'),
  read('lib/storage.mjs'), read('data/book.json'),
]);
const book = JSON.stringify(JSON.parse(rawBook)).replace(/</g, '\\u003c');
const withoutExports = (source) => source.replace(/^export /gm, '');
const bundle = `const { createSearchIndex, searchRecipes } = (() => {\n${withoutExports(search)}\nreturn { createSearchIndex, searchRecipes };\n})();\n` +
  `const { createUserStore } = (() => {\n${withoutExports(storage)}\nreturn { createUserStore };\n})();\n` +
  app.replace(/^import .*;\r?\n/gm, '');
let html = template
  .replace(/\s*<link rel="manifest"[^>]*>/, '')
  .replace('<link rel="stylesheet" href="/styles.css">', `<style>${css}</style>`)
  .replace('<script type="module" src="/app.js"></script>',
    `<script>window.HGT_EMBEDDED_BOOK=${book};window.HGT_SOURCE_PDF_URL='./source/book.pdf';</script>\n` +
    `<script type="module">${bundle.replace(/<\/script/gi, '<\\/script')}</script>`)
  .replaceAll('href="/source/book.pdf"', 'href="./source/book.pdf"');
const assets = [
  ['icons/icon.svg', 'image/svg+xml'],
  ['icons/icon-192.png', 'image/png'],
  ['icons/apple-touch-icon.png', 'image/png'],
  ['assets/cover.webp', 'image/webp'],
];
for (const [filename, mime] of assets) {
  const bytes = await fs.readFile(path.join(root, filename));
  html = html.replaceAll(`/${filename}`, `data:${mime};base64,${bytes.toString('base64')}`);
}
await fs.writeFile(path.join(root, 'Mo_Ung_Dung.html'), html);
console.log('Created Mo_Ung_Dung.html with embedded book, interface, and images.');
