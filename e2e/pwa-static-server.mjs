import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize } from "node:path";

const DIST_DIR = join(process.cwd(), "dist");
const PORT = Number(process.env.PWA_E2E_PORT ?? "4173");

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const baseSwSource = await readFile(join(DIST_DIR, "sw.js"), "utf-8");
let swVersion = 0;

const resolvePath = (pathname) => {
  if (pathname === "/") return join(DIST_DIR, "index.html");
  const trimmed = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  const normalized = normalize(trimmed);
  return join(DIST_DIR, normalized);
};

const sendJson = (res, statusCode, data) => {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
};

const serveSw = (res) => {
  const body = `${baseSwSource}\n// pwa-e2e-sw-version:${swVersion}\n`;
  res.writeHead(200, {
    "Content-Type": "application/javascript; charset=utf-8",
    "Cache-Control": "no-cache, no-store, must-revalidate",
  });
  res.end(body);
};

const server = createServer(async (req, res) => {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (method === "POST" && url.pathname === "/__test__/sw-version") {
    swVersion += 1;
    sendJson(res, 200, { ok: true, swVersion });
    return;
  }

  if (method !== "GET" && method !== "HEAD") {
    sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
    return;
  }

  if (url.pathname === "/sw.js") {
    serveSw(res);
    return;
  }

  const filePath = resolvePath(url.pathname);
  if (!filePath.startsWith(DIST_DIR)) {
    sendJson(res, 403, { ok: false, error: "Forbidden" });
    return;
  }

  try {
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) {
      throw new Error("Not a file");
    }

    const type = CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": "no-cache",
    });

    if (method === "HEAD") {
      res.end();
      return;
    }

    createReadStream(filePath).pipe(res);
  } catch {
    const fallbackFile = join(DIST_DIR, "index.html");
    try {
      const html = await readFile(fallbackFile);
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
      });
      res.end(html);
    } catch {
      sendJson(res, 500, { ok: false, error: "Failed to serve fallback index.html" });
    }
  }
});

server.listen(PORT, () => {
  console.log(`PWA e2e server listening on http://localhost:${PORT}`);
});
