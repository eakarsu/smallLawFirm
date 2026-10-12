import http from 'node:http';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function createRuntimeProxyServer({ targetPort }) {
  if (!Number.isInteger(targetPort) || targetPort < 1 || targetPort > 65535) throw new Error('A valid upstream runtime port is required');
  return http.createServer((request, response) => {
    if (!request.url?.startsWith('/api/')) { response.writeHead(404, { 'content-type': 'application/json' }); response.end(JSON.stringify({ error: 'Not found' })); return; }
    let incoming;
    const upstream = http.request({ hostname: '127.0.0.1', port: targetPort, path: request.url, method: request.method, headers: { ...request.headers, host: `127.0.0.1:${targetPort}` } }, upstreamResponse => {
      incoming = upstreamResponse;
      if (response.destroyed) { upstreamResponse.destroy(); return; }
      upstreamResponse.once('error', () => response.destroy());
      upstreamResponse.once('aborted', () => response.destroy());
      response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    });
    const cancel = () => { upstream.destroy(); incoming?.destroy(); };
    request.once('aborted', cancel);
    response.once('close', () => { if (!response.writableFinished) cancel(); });
    if (request.aborted || response.destroyed) { cancel(); return; }
    upstream.on('error', () => {
      if (request.aborted || response.destroyed || response.writableEnded) return;
      if (response.headersSent) { response.destroy(); return; }
      response.writeHead(502, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: "Application unavailable" }));
    });
    request.pipe(upstream);
  });
}

const directEntry = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (directEntry) {
  const targetPort = Number(process.env.FRONTEND_PORT), listenPort = Number(process.env.BACKEND_PORT);
  if (!Number.isInteger(listenPort) || listenPort < 1 || listenPort > 65535 || targetPort === listenPort) throw new Error('Distinct valid runtime proxy ports are required');
  const server = createRuntimeProxyServer({ targetPort });
  server.listen(listenPort, '127.0.0.1', () => console.log(`Small Law Firm API gateway listening on http://127.0.0.1:${listenPort}`));
  const shutdown = () => server.close(() => process.exit(0));
  process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown);
}
