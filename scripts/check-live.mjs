import assert from 'node:assert/strict';
import configuration from '../shared/supabase.json' with {type:'json'};
import family from '../shared/participants.json' with {type:'json'};
import {createSupabaseHandler} from '../server/supabase-proxy.mjs';
const endpoint=`${configuration.url}/functions/v1/familia-ferreira`;
async function call(request){
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',apikey:configuration.publishableKey},body:JSON.stringify(request),signal:AbortSignal.timeout(30000)});
 return {status:response.status,envelope:await response.json()};
}
const health=await call({method:'GET',path:'/health',input:{}});
assert.equal(health.status,200);assert.equal(health.envelope.data.ok,true);
const event=await call({method:'GET',path:'/event',input:{}});
assert.equal(event.status,200);assert.deepEqual(event.envelope.data.participants.map(p=>p.name),family);
assert.deepEqual(Object.keys(event.envelope.data.participants[0]).sort(),['id','name']);
const dashboard=await call({method:'GET',path:'/admin/dashboard',input:{}});
assert.equal(dashboard.status,401);assert.equal(dashboard.envelope.session,undefined);
// The publishable key must NOT be able to invoke the privileged database RPC.
const denied=await fetch(`${configuration.url}/rest/v1/rpc/familia_ferreira_api`,{method:'POST',headers:{'Content-Type':'application/json',apikey:configuration.publishableKey},body:JSON.stringify({request:{method:'GET',path:'/admin/results',input:{}}}),signal:AbortSignal.timeout(20000)});
assert.ok(denied.status===401||denied.status===403||denied.status===404,`Direct RPC must be denied (${denied.status})`);
const handler=createSupabaseHandler({endpoint,publishableKey:configuration.publishableKey});
const res={headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v;},status(s){this.statusCode=s;return this;},json(data){this.data=data;}};
await handler({url:'/api/event',method:'GET',headers:{host:'familia.test'}},res);
assert.equal(res.statusCode,200);assert.equal(res.data.participants.length,family.length);
console.log('PASS: deployed Supabase function, 14 public names, admin authentication, blocked direct RPC and Vercel handler. No records changed.');
