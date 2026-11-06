// A tiny static server for the exported site in `out/`, the way GitHub Pages
// serves it: `/pay/` serves `pay/index.html`, and anything missing gets 404.html.
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..", "out");
const port = Number(process.env.PORT ?? 4173);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
};

function find(pathname) {
  const file = normalize(join(root, decodeURIComponent(pathname)));
  if (!file.startsWith(root)) return null;
  if (existsSync(file) && statSync(file).isFile()) return file;
  const index = join(file, "index.html");
  if (existsSync(index)) return index;
  return null;
}

createServer((req, res) => {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  // Pages redirects /pay to /pay/ when the folder exists.
  if (!pathname.endsWith("/") && !extname(pathname) && find(`${pathname}/`)) {
    res.writeHead(301, { location: `${pathname}/` }).end();
    return;
  }
  const file = find(pathname);
  const status = file ? 200 : 404;
  const body = file ?? join(root, "404.html");
  res.writeHead(status, { "content-type": TYPES[extname(body)] ?? "application/octet-stream" });
  createReadStream(body).pipe(res);
}).listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));
