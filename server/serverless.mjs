import { Readable } from 'node:stream';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './app.mjs';

function execute(app, request) {
  return new Promise((resolve,reject) => {
    const req = Readable.from(request.rawBody ? [Buffer.from(request.rawBody)] : []);
    req.method=request.method; req.url=request.url; req.headers=request.headers;
    req.socket={remoteAddress:request.address || 'unknown'};
    const headers={};
    const res={
      headersSent:false, statusCode:200,
      setHeader(key,value){headers[key.toLowerCase()]=value;},
      writeHead(status,extra){this.statusCode=status;this.headersSent=true;for(const [key,value] of Object.entries(extra))headers[key.toLowerCase()]=value;},
      end(body=''){resolve({ status:this.statusCode, headers, body:String(body) });}
    };
    try { app.server.emit('request',req,res); } catch(error) { reject(error); }
  });
}

// A complete private SQLite snapshot is appropriate for this fixed 12-person event.
// Each update uses an ETag lease. Losing writers reload and retry the whole operation.
// Never send cookies, codes or a success response until the durable write succeeds.
export async function runServerlessRequest(store, request, { origin, maxAttempts=16, pause=ms=>new Promise(r=>setTimeout(r,ms)) } = {}) {
  for(let attempt=0;attempt<maxAttempts;attempt++) {
    const snapshot=await store.read();
    const directory=await mkdtemp(join(tmpdir(),'familia-vercel-'));
    const databasePath=join(directory,'familia.sqlite');
    let app;
    try {
      if(snapshot)await writeFile(databasePath,snapshot.bytes,{mode:0o600});
      app=createApp({databasePath,origin,production:true});
      const before=app.db.prepare('SELECT total_changes() AS n').get().n;
      const response=await execute(app,request);
      const changed=app.db.prepare('SELECT total_changes() AS n').get().n !== before;
      app.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
      app.db.close();app.server.close();app=null;
      if(changed) {
        try { await store.write(await readFile(databasePath),snapshot?.etag ?? null); }
        catch(error) {
          if(!store.isConflict(error))throw error;
          if(attempt===maxAttempts-1)break;
          await pause(30+Math.floor(Math.random()*Math.min(200,40*(attempt+1))));
          continue;
        }
      }
      return response;
    } finally {
      if(app){app.server.close();app.db.close();}
      await rm(directory,{recursive:true,force:true});
    }
  }
  return {status:409,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},body:JSON.stringify({error:'Outra pessoa está atualizando o sorteio. Tente novamente em alguns segundos.'})};
}
