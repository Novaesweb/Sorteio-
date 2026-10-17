import family from '../shared/participants.json' with {type:'json'};
// Checks the real published site, not only the underlying Supabase function.
// All requests are read-only and create no sessions or login attempts.
const base='https://sorteio202700.vercel.app';
const paths=[['/api/health',200],['/api/event',200],['/api/admin/dashboard',401],['/api/admin/login',401],['/api/admin/results',401]];
let last;
for(let attempt=0;attempt<12;attempt++){
 try{
  for(const [path,status] of paths){
   const response=await fetch(base+path,{signal:AbortSignal.timeout(10000),redirect:'manual',headers:{'Cache-Control':'no-cache'}});
   const type=response.headers.get('content-type')||'';
   if(response.status!==status||!type.includes('application/json'))throw new Error(`${path}: expected JSON ${status}, got ${response.status} ${type}`);
   const data=await response.json();
   if(path==='/api/health'&&data.ok!==true)throw new Error('Health response invalid');
   if(path==='/api/event'&&data.participants?.length!==family.length)throw new Error('Participants response invalid');
   if(status===401&&typeof data.error!=='string')throw new Error('Authentication response invalid');
   console.log(`PASS ${path}: JSON ${status}`);
  }
  console.log('PASS: published Vercel site, nested admin/login routes, 14 participants and protected admin data.');
  process.exit(0);
 }catch(error){last=error;console.log(`Waiting for deployment (${attempt+1}/12): ${error.message}`);}
 if(attempt<11)await new Promise(resolve=>setTimeout(resolve,5000));
}
console.error(last.message);process.exitCode=1;
