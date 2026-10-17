const base='https://sorteio202700.vercel.app';
for(const path of ['/api/health','/api/event','/api/admin/dashboard']){
 try{
  const response=await fetch(base+path,{signal:AbortSignal.timeout(15000),redirect:'manual'});
  const body=await response.text();
  console.log(JSON.stringify({path,status:response.status,type:response.headers.get('content-type'),location:response.headers.get('location'),body:body.slice(0,300)}));
 }catch(error){console.log(JSON.stringify({path,error:error.message}));}
}
