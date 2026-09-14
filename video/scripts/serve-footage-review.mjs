import http from "node:http";
import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = await realpath(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../assets/storyboard/you-handle-today-footage",
  ),
);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".md": "text/plain; charset=utf-8",
  ".srt": "text/plain; charset=utf-8",
};

http
  .createServer(async (request, response) => {
    try {
      if (!["GET", "HEAD"].includes(request.method)) {
        response.writeHead(405, { Allow: "GET, HEAD" }).end();
        return;
      }
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      const candidate = path.resolve(
        root,
        "." + pathname,
        pathname.endsWith("/") ? "index.html" : "",
      );
      const file = await realpath(candidate);
      if (!file.startsWith(root + path.sep)) throw new Error("Outside preview folder");
      const info = await stat(file);
      if (!info.isFile()) throw new Error("Not a file");
      let start = 0;
      let end = info.size - 1;
      const headers = {
        "Content-Type": mime[path.extname(file)] ?? "application/octet-stream",
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
      };
      if (request.headers.range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
        if (match && (match[1] || match[2])) {
          start = match[1] ? Number(match[1]) : Math.max(0, info.size - Number(match[2]));
          end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end;
        } else start = -1;
        if (
          !Number.isSafeInteger(start) ||
          !Number.isSafeInteger(end) ||
          start < 0 ||
          end < start ||
          start >= info.size
        ) {
          response.writeHead(416, { "Content-Range": `bytes */${info.size}` }).end();
          return;
        }
        headers["Content-Range"] = `bytes ${start}-${end}/${info.size}`;
      }
      headers["Content-Length"] = end - start + 1;
      response.writeHead(request.headers.range ? 206 : 200, headers);
      if (request.method === "HEAD") return response.end();
      const stream = createReadStream(file, { start, end });
      response.on("close", () => stream.destroy());
      stream.on("error", () => response.destroy());
      stream.pipe(response);
    } catch {
      if (!response.headersSent) response.writeHead(404);
      response.end();
    }
  })
  .listen(8792, "127.0.0.1", () => console.log("Footage review: http://127.0.0.1:8792/assembly/"));
