// Own participant/admin session authentication is performed by the RPC for every
// restricted operation. No Supabase service credentials are returned to callers.
function secretKey(): string {
  const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
  return keys.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
}
async function readBody(req: Request): Promise<Record<string,unknown>> {
  const reader=req.body?.getReader();let length=0;const parts:Uint8Array[]=[];
  if(reader)while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>8192){await reader.cancel();throw new Error('PayloadTooLarge');}parts.push(value);}
  const bytes=new Uint8Array(length);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
  return JSON.parse(new TextDecoder().decode(bytes)||'{}');
}
Deno.serve(async(req:Request)=>{
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
  const respond=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
  try {
    let request:Record<string,unknown>;
    const suffix=new URL(req.url).pathname.split('/familia-ferreira')[1];
    if(req.method==='GET' && (suffix==='/event'||suffix==='/health'))request={method:'GET',path:suffix,input:{}};
    else if(req.method==='POST')request=await readBody(req);
    else return respond(405,{status:405,data:{error:'Método não permitido.'}});
    const path=request.path;
    if(typeof path!=='string'||path.length>100||!['GET','POST'].includes(String(request.method))||typeof request.input!=='object'||Array.isArray(request.input)||request.input===null)return respond(400,{status:400,data:{error:'Dados inválidos.'}});
    if(request.sessionToken!==undefined && (typeof request.sessionToken!=='string'||request.sessionToken.length>128))return respond(400,{status:400,data:{error:'Sessão inválida.'}});
    const key=secretKey();const base=Deno.env.get('SUPABASE_URL');
    if(!key||!base)throw new Error('MissingServerConfiguration');
    const response=await fetch(`${base}/rest/v1/rpc/familia_ferreira_api`,{
      method:'POST',headers:{'Content-Type':'application/json',apikey:key,...(key.startsWith('eyJ')?{Authorization:`Bearer ${key}`}:{})},
      body:JSON.stringify({request}),signal:AbortSignal.timeout(20000)
    });
    if(!response.ok){console.error('Family RPC failed:',response.status);return respond(503,{status:503,data:{error:'Não foi possível acessar o sorteio. Tente novamente em instantes.'}});}
    const envelope=await response.json();
    if(!Number.isInteger(envelope.status)||envelope.status<200||envelope.status>599)throw new Error('InvalidDatabaseResponse');
    return respond(envelope.status,envelope);
  }catch(error){
    const name=error instanceof Error?error.message:'Unknown';
    if(name==='PayloadTooLarge')return respond(413,{status:413,data:{error:'Dados muito grandes.'}});
    if(error instanceof SyntaxError)return respond(400,{status:400,data:{error:'Dados inválidos.'}});
    console.error('Family backend unavailable');return respond(503,{status:503,data:{error:'Sorteio temporariamente indisponível. Tente novamente.'}});
  }
});
