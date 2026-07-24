#!/usr/bin/env node
/* ══════════════════════════════════════════════
   QUANTORYX v6 — DEV SERVER
   Serves dist/ and proxies /api → the FastAPI backend
   (HTTP + WebSocket upgrade), so the SPA runs same-origin
   and no CORS or absolute URLs are needed.

   usage: node build/devserver.js [port] [backendPort]
══════════════════════════════════════════════ */
const http=require('http');
const net=require('net');
const fs=require('fs');
const path=require('path');

const PORT=+(process.argv[2]||4173);
const API_PORT=+(process.argv[3]||8000);
const API_HOST='127.0.0.1';
const DIST=path.resolve(__dirname,'..','dist');

const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css',
  '.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.ico':'image/x-icon'};

const server=http.createServer((req,res)=>{
  if(req.url.startsWith('/api')){
    const p=http.request({host:API_HOST,port:API_PORT,path:req.url,method:req.method,
      headers:{...req.headers,host:`${API_HOST}:${API_PORT}`}},up=>{
      res.writeHead(up.statusCode,up.headers); up.pipe(res);
    });
    p.on('error',e=>{ res.writeHead(502,{'Content-Type':'application/json'});
      res.end(JSON.stringify({detail:`Backend unreachable: ${e.message}`})); });
    req.pipe(p);
    return;
  }
  let file=req.url.split('?')[0];
  if(file==='/'||file==='') file=process.env.QX_TARGET||'/Quantoryx-v6-Complete.html';
  const full=path.join(DIST,path.normalize(file).replace(/^(\.\.[/\\])+/,''));
  fs.readFile(full,(err,buf)=>{
    if(err){ res.writeHead(404,{'Content-Type':'text/plain'}); res.end('Not found'); return; }
    res.writeHead(200,{'Content-Type':MIME[path.extname(full)]||'application/octet-stream',
      'Cache-Control':'no-store'});
    res.end(buf);
  });
});

/* WebSocket upgrade passthrough for /api/ws/{user_id} */
server.on('upgrade',(req,sock,head)=>{
  if(!req.url.startsWith('/api')){ sock.destroy(); return; }
  const up=net.connect(API_PORT,API_HOST,()=>{
    up.write(`${req.method} ${req.url} HTTP/1.1\r\n`+
      Object.entries(req.headers).map(([k,v])=>`${k}: ${v}`).join('\r\n')+'\r\n\r\n');
    if(head&&head.length) up.write(head);
    sock.pipe(up); up.pipe(sock);
  });
  up.on('error',()=>sock.destroy());
  sock.on('error',()=>up.destroy());
});

server.listen(PORT,()=>{
  console.log(`▶ Quantoryx dev server  http://127.0.0.1:${PORT}`);
  console.log(`  /api  →  http://${API_HOST}:${API_PORT}  (HTTP + WS)`);
});
