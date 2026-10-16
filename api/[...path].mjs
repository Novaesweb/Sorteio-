import * as blob from '@vercel/blob';
import { createHash } from 'node:crypto';
import { createBlobStore } from '../server/blob-store.mjs';
import { runServerlessRequest } from '../server/serverless.mjs';
import family from '../shared/participants.json' with { type:'json' };

export const config = { maxDuration:30 };

export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  const url=new URL(req.url,'https://frontend.invalid');
  if(!url.pathname.startsWith('/api/'))return res.status(404).json({error:'Operação não encontrada.'});
  const connected=Boolean(process.env.BLOB_READ_WRITE_TOKEN || (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN));
  if(!connected) {
    if(req.method==='GET'&&url.pathname==='/api/event')return res.status(200).json({participants:family.map((name,i)=>({id:i+1,name})),startedAt:null,year:2027,storageReady:false});
    return res.status(503).json({error:url.pathname.startsWith('/api/admin/')?'Falta ativar o armazenamento deste site: na Vercel, abra Storage, crie um Blob privado, conecte ao projeto e faça Redeploy.':'Os cadastros ainda não foram liberados. Aguarde o organizador finalizar a preparação.'});
  }
  try {
    let rawBody='';
    if(!['GET','HEAD'].includes(req.method)) {
      if(req.body!==undefined)rawBody=typeof req.body==='string'?req.body:JSON.stringify(req.body);
      else for await(const chunk of req){rawBody+=chunk;if(Buffer.byteLength(rawBody)>8192)return res.status(413).json({error:'Dados muito grandes.'});}
      if(Buffer.byteLength(rawBody)>8192)return res.status(413).json({error:'Dados muito grandes.'});
    }
    // Previews use a distinct file so testing cannot reset the production event.
    const environment=process.env.VERCEL_ENV || 'production';
    const branch=process.env.VERCEL_GIT_COMMIT_REF || 'preview';
    const scope=environment==='production'?'production':`preview-${createHash('sha256').update(branch).digest('hex').slice(0,16)}`;
    const store=createBlobStore(blob,`familia-ferreira/2027/${scope}.sqlite`);
    const host=req.headers.host;
    if(typeof host!=='string'||!host)return res.status(400).json({error:'Endereço do site inválido.'});
    const response=await runServerlessRequest(store,{
      method:req.method,url:req.url,headers:req.headers,rawBody,
      address:String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'vercel').split(',')[0].trim()
    },{origin:`https://${host}`});
    res.statusCode=response.status;
    for(const [key,value] of Object.entries(response.headers))res.setHeader(key,value);
    res.end(response.body);
  } catch(error) {
    console.error('Falha na persistência Vercel:',error.name);
    res.status(503).json({error:'Não foi possível acessar o armazenamento privado. Confira se o Blob é privado e está conectado ao projeto; depois tente novamente.'});
  }
}
