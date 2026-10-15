import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import type { ServerResponse } from 'http';

function p2pRelayPlugin(): Plugin {
  const rooms = new Map<string, { clients: Set<ServerResponse> }>();

  return {
    name: 'p2p-relay',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/p2p/')) return next();

        const host = req.headers.host || '127.0.0.1:5173';
        const url = new URL(req.url, `http://${host}`);
        const room = (url.searchParams.get('room') || 'default').toUpperCase();

        // 1. Server-Sent Events (SSE) stream for real-time push to all connected devices
        if (url.pathname === '/api/p2p/events') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
          });

          res.write(`data: ${JSON.stringify({ type: 'SSE_READY', room })}\n\n`);

          let roomData = rooms.get(room);
          if (!roomData) {
            roomData = { clients: new Set() };
            rooms.set(room, roomData);
          }
          roomData.clients.add(res);

          req.on('close', () => {
            const r = rooms.get(room);
            if (r) {
              r.clients.delete(res);
              if (r.clients.size === 0) {
                rooms.delete(room);
              }
            }
          });
          return;
        }

        // 2. HTTP POST message dispatcher (broadcasts message to all clients in room)
        if (url.pathname === '/api/p2p/send' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('end', () => {
            try {
              const msg = JSON.parse(body);
              const roomData = rooms.get(room);
              if (roomData && roomData.clients.size > 0) {
                const ssePayload = `data: ${JSON.stringify(msg)}\n\n`;
                roomData.clients.forEach((client) => {
                  try {
                    client.write(ssePayload);
                  } catch {
                    // disconnected
                  }
                });
              }

              res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              });
              res.end(JSON.stringify({ ok: true, recipients: roomData?.clients.size || 0 }));
            } catch {
              res.writeHead(400);
              res.end('Invalid JSON payload');
            }
          });
          return;
        }

        // 3. Canva Link & Template Resolver API
        if (url.pathname === '/api/canva/resolve') {
          const targetUrl = url.searchParams.get('url');
          if (!targetUrl) {
            res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: 'Missing url parameter' }));
            return;
          }

          (async () => {
            try {
              let finalUrl = targetUrl.trim();

              // Follow redirects to get the real Canva design URL
              const followRes = await fetch(finalUrl, {
                redirect: 'follow',
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                },
              });

              finalUrl = followRes.url || finalUrl;
              const html = await followRes.text();

              // Search for document image URL in HTML or og:image or JSON state
              let imgUrl: string | null = null;

              // Pattern 1: High-res document image
              const matchDoc = html.match(/https:\/\/media\.canva\.com\/v2\/document-image\/[^\"\'\s<>]+/);
              if (matchDoc) {
                imgUrl = matchDoc[0].replace(/&amp;/g, '&');
              }

              // Pattern 2: Open Graph / Twitter meta preview image
              if (!imgUrl) {
                const matchMeta = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
                                  html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i) ||
                                  html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i);
                if (matchMeta && matchMeta[1]) {
                  imgUrl = matchMeta[1].replace(/&amp;/g, '&');
                }
              }

              // Pattern 3: Any Canva media image URL in JSON state
              if (!imgUrl) {
                const matchMedia = html.match(/https:\/\/[a-zA-Z0-9\.\-]*media[a-zA-Z0-9\.\-]*\.canva\.com\/[^\"\'\s<>\\]+/);
                if (matchMedia) {
                  imgUrl = matchMedia[0].replace(/&amp;/g, '&').replace(/\\u0026/g, '&');
                }
              }

              // Pattern 4: Try /view version if currently on /edit
              if (!imgUrl && finalUrl.includes('/edit')) {
                const viewUrl = finalUrl.replace(/\/edit(\?.*)?$/, '/view$1');
                const viewRes = await fetch(viewUrl, {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  },
                });
                const viewHtml = await viewRes.text();
                const vMatch = viewHtml.match(/https:\/\/media\.canva\.com\/v2\/document-image\/[^\"\'\s<>]+/) ||
                               viewHtml.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
                if (vMatch) {
                  imgUrl = (vMatch[1] || vMatch[0]).replace(/&amp;/g, '&');
                }
              }

              if (imgUrl) {
                const imgRes = await fetch(imgUrl);
                const arrayBuffer = await imgRes.arrayBuffer();
                const base64 = Buffer.from(arrayBuffer).toString('base64');
                const mime = imgRes.headers.get('content-type') || 'image/png';
                const dataUrl = `data:${mime};base64,${base64}`;

                res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ success: true, imageUrl: dataUrl, rawUrl: imgUrl }));
              } else {
                res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: 'Không tìm thấy ảnh xem trước trong link Canva này. Bạn có thể xuất file PNG từ Canva và tải lên nhé!' }));
              }
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Unknown error';
              res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({ error: msg }));
            }
          })();
          return;
        }

        next();
      });
    },
  };
}

import { handleHotFolderApiRequest } from './src/server/hotFolderApi';

function hotFolderVitePlugin(): Plugin {
  return {
    name: 'hot-folder-server',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        handleHotFolderApiRequest(req, res, next);
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), p2pRelayPlugin(), hotFolderVitePlugin()],
  server: {
    host: true, // Listen on 0.0.0.0 so other devices on same Wi-Fi can connect
    port: 5173,
  },
});
