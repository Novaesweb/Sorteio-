const COOKIE_ROLES=new Set(['admin','participant']);
export function createSupabaseHandler({endpoint,publishableKey,fetcher=fetch,production=true,preview=false}){
 return async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');
  const path=new URL(req.url,'https://frontend.invalid').pathname.replace(/^\/api/,'');
  if(!req.url.startsWith('/api/'))return res.status(404).json({error:'Operação não encontrada.'});
  if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Método não permitido.'});
  if(preview&&req.method==='POST')return res.status(403).json({error:'Use o endereço principal publicado para participar ou administrar o sorteio. O preview não altera dados da família.'});
  const scheme=production?'https':'http';
  if(req.method==='POST'&&req.headers.origin&&req.headers.origin!==`${scheme}://${req.headers.host}`)return res.status(403).json({error:'Origem não permitida.'});
  try{
   let input={};
   if(req.method==='POST'){
    if(!req.headers['content-type']?.startsWith('application/json'))return res.status(415).json({error:'Envie os dados em JSON.'});
    let raw='';
    if(req.body!==undefined)raw=typeof req.body==='string'?req.body:JSON.stringify(req.body);
    else for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>8192)return res.status(413).json({error:'Dados muito grandes.'});}
    if(Buffer.byteLength(raw)>8192)return res.status(413).json({error:'Dados muito grandes.'});
    try{input=JSON.parse(raw||'{}');}catch{return res.status(400).json({error:'Dados inválidos.'});}
    if(!input||typeof input!=='object'||Array.isArray(input))return res.status(400).json({error:'Dados inválidos.'});
   }
   const role=path.startsWith('/admin/')?'admin':'participant';
   const cookieName=`${production?'__Host-':''}familia_${role}`;
   const cookie=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(`${cookieName}=`));
   const rawToken=cookie?.slice(cookieName.length+1)||'';
   const sessionToken=/^[a-f0-9]{64}$/.test(rawToken)?rawToken:'';
   const response=await fetcher(endpoint,{
    method:'POST',headers:{'Content-Type':'application/json',apikey:publishableKey},
    body:JSON.stringify({method:req.method,path,input,sessionToken}),signal:AbortSignal.timeout(25000)
   });
   const envelope=await response.json();
   if(!Number.isInteger(envelope.status)||envelope.status<200||envelope.status>599||!Object.hasOwn(envelope,'data'))throw new Error('InvalidBackendResponse');
   if(envelope.session && envelope.status===200){
    const s=envelope.session;
    if(!COOKIE_ROLES.has(s.role)||!Number.isInteger(s.maxAge)||s.maxAge<0||s.maxAge>604800||!(s.token===''||/^[a-f0-9]{64}$/.test(s.token)))throw new Error('InvalidSession');
    if(s.role!==role)throw new Error('InvalidSessionRole');
    res.setHeader('Set-Cookie',`${production?'__Host-':''}familia_${s.role}=${s.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${s.maxAge}${production?'; Secure':''}`);
   }
   // Internal session metadata stays in an HttpOnly cookie, never in the page JSON.
   return res.status(envelope.status).json(envelope.data);
  }catch{return res.status(503).json({error:'Não foi possível acessar o sorteio. Tente novamente em instantes.'});}
 };
}
