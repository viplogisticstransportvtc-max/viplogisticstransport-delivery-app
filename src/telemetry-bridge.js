'use strict';
const http=require('node:http');
let latest={connected:false,adapterStatus:{state:'OFFLINE',reason:'No telemetry source connected.'}};
function startTelemetryBridge(port=25555){
 const server=http.createServer((req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Cache-Control','no-store');
  if(req.method==='GET'&&req.url.startsWith('/telemetry')){const stale=!latest.timestamp||Date.now()-latest.timestamp>2500;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({...latest,connected:Boolean(latest.connected&&!stale)}));return;}
  if(req.method==='POST'&&(req.url==='/telemetry'||req.url==='/status')){let body='';req.on('data',c=>body+=c);req.on('end',()=>{try{const d=JSON.parse(body||'{}');if(req.url==='/telemetry')latest={...latest,...d,adapterStatus:latest.adapterStatus};else latest={...latest,adapterStatus:d};res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true}));}catch(e){res.writeHead(400);res.end(JSON.stringify({error:e.message}));}});return;}
  res.writeHead(404);res.end('Not found');
 });server.listen(port,'127.0.0.1');return server;
}
module.exports={startTelemetryBridge};
