import http from 'node:http';
const apiPort = Number(process.env.BACKEND_PORT); const uiPort = Number(process.env.FRONTEND_PORT);
if (!Number.isInteger(apiPort) || !Number.isInteger(uiPort) || apiPort === uiPort) throw new Error('Distinct runtime ports are required');
const server = http.createServer((request,response) => {
  if (!request.url?.startsWith('/api/')) { response.writeHead(404,{'content-type':'application/json'}); return response.end(JSON.stringify({error:'Not found'})); }
  const upstream=http.request({hostname:'127.0.0.1',port:uiPort,path:request.url,method:request.method,headers:{...request.headers,host:`127.0.0.1:${uiPort}`}},upstreamResponse=>{response.writeHead(upstreamResponse.statusCode||502,upstreamResponse.headers);upstreamResponse.pipe(response)});
  upstream.on('error',()=>{if(!response.headersSent)response.writeHead(502,{'content-type':'application/json'});response.end(JSON.stringify({error:'Application unavailable'}))});request.pipe(upstream);
});
server.listen(apiPort,'127.0.0.1',()=>console.log(`Small Law Firm API gateway listening on http://127.0.0.1:${apiPort}`));
const shutdown=()=>server.close(()=>process.exit(0));process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
