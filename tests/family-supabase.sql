-- Run against Sites demo only. Every test mutation is rolled back.
begin;
set local role service_role;
-- Test-only code; this update and all test data are rolled back.
update familia_ferreira_2027.settings set admin_code_hash=extensions.crypt('123456',extensions.gen_salt('bf',10));
do $$
declare
 r jsonb; a text; code_rows jsonb; one jsonb; u text; r1 jsonb; r2 jsonb;
 tokens text[]:=array[]::text[]; code1 text; counter integer; n integer;
begin
 assert not has_function_privilege('anon','public.familia_ferreira_api(jsonb)','execute'),'anon must not invoke private RPC';
 assert not has_function_privilege('authenticated','public.familia_ferreira_api(jsonb)','execute'),'authenticated must not invoke private RPC';
 assert not has_schema_privilege('anon','familia_ferreira_2027','usage'),'private schema must not be public';
 r:=public.familia_ferreira_api('{"method":"GET","path":"/event","input":{}}');
 assert (r->>'status')::int=200 and jsonb_array_length(r->'data'->'participants')=12,'public list must contain 12 names';
 assert not ((r->'data'->'participants'->0)?'code_hash'),'public names must not expose hashes';
 r:=public.familia_ferreira_api('{"method":"GET","path":"/admin/dashboard","input":{}}');assert (r->>'status')::int=401,'dashboard requires auth';
 r:=public.familia_ferreira_api('{"method":"POST","path":"/admin/login","input":{"password":"wrong"}}');assert (r->>'status')::int=401,'incorrect admin code must fail';
 r:=public.familia_ferreira_api('{"method":"POST","path":"/admin/login","input":{"password":"123456"}}');assert (r->>'status')::int=200,'admin code must work';a:=r->'session'->>'token';
 r:=public.familia_ferreira_api(jsonb_build_object('method','POST','path','/admin/codes','input','{}'::jsonb,'sessionToken',a));
 assert (r->>'status')::int=200 and jsonb_array_length(r->'data')=12,'must generate 12 individual codes';code_rows:=r->'data';code1:=code_rows->0->>'code';
 for one in select value from jsonb_array_elements(code_rows) loop
  r:=public.familia_ferreira_api(jsonb_build_object('method','POST','path','/login','input',jsonb_build_object('id',one->'id','code',one->>'code')));
  assert (r->>'status')::int=200,'participant login must work';tokens:=array_append(tokens,r->'session'->>'token');
 end loop;
 u:=tokens[1];
 r:=public.familia_ferreira_api(jsonb_build_object('method','GET','path','/admin/results','input','{}'::jsonb,'sessionToken',u));assert (r->>'status')::int=401,'participant must not see global pairs';
 r:=public.familia_ferreira_api(jsonb_build_object('method','GET','path','/me','input','{}'::jsonb,'sessionToken',u));assert not ((r->'data')?'receiver'),'profile must not reveal receiver';
 r:=public.familia_ferreira_api(jsonb_build_object('method','POST','path','/reveal','input','{}'::jsonb,'sessionToken',u));assert (r->>'status')::int=409,'cannot reveal before start';
 r:=public.familia_ferreira_api(jsonb_build_object('method','POST','path','/admin/start','input','{}'::jsonb,'sessionToken',a));assert (r->>'status')::int=200,'global draw must start';
 r:=public.familia_ferreira_api(jsonb_build_object('method','POST','path','/admin/start','input','{}'::jsonb,'sessionToken',a));assert (r->>'status')::int=409,'cannot redraw';
 select count(*) into n from familia_ferreira_2027.pairs;assert n=12,'must have 12 pairs';
 assert not exists(select 1 from familia_ferreira_2027.pairs where giver=receiver),'no self assignment';
 for counter in 1..12 loop
  r:=public.familia_ferreira_api(jsonb_build_object('method','POST','path','/reveal','input','{}'::jsonb,'sessionToken',tokens[counter]));
  assert (r->>'status')::int=200,'each participant must reveal';
  assert (r->'data'->'receiver'->>'id')::int<>counter,'own result must not be self';
 end loop;
 r1:=public.familia_ferreira_api(jsonb_build_object('method','POST','path','/reveal','input','{}'::jsonb,'sessionToken',u));
 r2:=public.familia_ferreira_api(jsonb_build_object('method','GET','path','/result','input','{}'::jsonb,'sessionToken',u));assert r1=r2,'result and date must stay stable';
 r:=public.familia_ferreira_api(jsonb_build_object('method','POST','path','/login','input',jsonb_build_object('id',1,'code',code1)));u:=r->'session'->>'token';
 r2:=public.familia_ferreira_api(jsonb_build_object('method','GET','path','/result','input','{}'::jsonb,'sessionToken',u));assert r1=r2,'new device must see same result';
 r:=public.familia_ferreira_api(jsonb_build_object('method','GET','path','/admin/dashboard','input','{}'::jsonb,'sessionToken',a));
 select count(*) into n from jsonb_array_elements(r->'data'->'participants') p where p->>'confirmed_at' is not null and p->>'revealed_at' is not null;assert n=12,'dashboard must track all confirmations and revelations';
 r:=public.familia_ferreira_api(jsonb_build_object('method','POST','path','/admin/participants','input',jsonb_build_object('action','add','name','Other'),'sessionToken',a));assert (r->>'status')::int=403,'roster is fixed';
 r:=public.familia_ferreira_api(jsonb_build_object('method','POST','path','/admin/codes','input',jsonb_build_object('id',1),'sessionToken',a));
 r2:=public.familia_ferreira_api(jsonb_build_object('method','GET','path','/result','input','{}'::jsonb,'sessionToken',u));assert (r2->>'status')::int=401,'new code must revoke old sessions';
 r:=public.familia_ferreira_api(jsonb_build_object('method','POST','path','/admin/reset','input',jsonb_build_object('confirmation','wrong','password','123456'),'sessionToken',a));assert (r->>'status')::int=400,'reset must require confirmation';
 r:=public.familia_ferreira_api(jsonb_build_object('method','POST','path','/admin/reset','input',jsonb_build_object('confirmation','INVALIDAR RESULTADOS','password','123456'),'sessionToken',a));assert (r->>'status')::int=200,'reset must succeed with reinforced confirmation';
 assert not exists(select 1 from familia_ferreira_2027.pairs),'reset must remove all pairs';
 assert not exists(select 1 from familia_ferreira_2027.sessions where role='participant'),'reset must revoke participant sessions';
 -- Exercise the production SQL draw repeatedly. Constraints reject duplicates.
 for counter in 1..100 loop
  r:=public.familia_ferreira_api(jsonb_build_object('method','POST','path','/admin/start','input','{}'::jsonb,'sessionToken',a));assert (r->>'status')::int=200,'draw must succeed';
  assert (select count(*)=12 and count(distinct receiver)=12 and bool_and(giver<>receiver) from familia_ferreira_2027.pairs),'draw invariants must hold';
  delete from familia_ferreira_2027.pairs;update familia_ferreira_2027.settings set started_at=null;
 end loop;
end $$;
rollback;
select 'PASS: auth, 12 participants, privacy, stable results, reset, 100 draws; all test data rolled back' as result;
