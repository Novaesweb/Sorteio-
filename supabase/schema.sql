-- Exclusive namespace for the family event. Other demo sites must use their own schema.
create schema if not exists familia_ferreira_2027;
revoke all on schema familia_ferreira_2027 from public, anon, authenticated;
grant usage on schema familia_ferreira_2027 to service_role;

create table if not exists familia_ferreira_2027.settings (
 id boolean primary key default true check(id),
 started_at timestamptz,
 admin_code_hash text not null,
 year integer not null default 2027,
 gift_min numeric(8,2) not null default 40,
 gift_max numeric(8,2) not null default 70
);
insert into familia_ferreira_2027.settings(id,admin_code_hash)
 values(true,extensions.crypt(encode(extensions.gen_random_bytes(32),'hex'),extensions.gen_salt('bf',10))) on conflict do nothing;
create table if not exists familia_ferreira_2027.participants (
 id smallint primary key check(id between 1 and 14), name text not null unique,
 code_hash text, confirmed_at timestamptz, revealed_at timestamptz
);
insert into familia_ferreira_2027.participants(id,name)
 select ordinality::smallint,name from unnest(array['Caíque Eduardo','Estephane','Jéssica Rafaela','Igor','Caio','Rafael','Iris Ferreira','Augusto','Lucas Rodrigo','Camila Dias','Jenifer','Erick','Patrícia','Noah']) with ordinality as p(name,ordinality)
 on conflict do nothing;
create table if not exists familia_ferreira_2027.pairs (
 giver smallint primary key references familia_ferreira_2027.participants(id),
 receiver smallint not null unique references familia_ferreira_2027.participants(id),
 check(giver<>receiver)
);
create table if not exists familia_ferreira_2027.sessions (
 hash text primary key, role text not null check(role in ('admin','participant')),
 participant_id smallint references familia_ferreira_2027.participants(id) on delete cascade,
 expires timestamptz not null,
 check((role='admin' and participant_id is null) or (role='participant' and participant_id is not null))
);
create index if not exists sessions_participant_idx on familia_ferreira_2027.sessions(participant_id);
create index if not exists sessions_expires_idx on familia_ferreira_2027.sessions(expires);
create table if not exists familia_ferreira_2027.login_attempts (
 key text primary key, count integer not null, expires timestamptz not null
);
create table if not exists familia_ferreira_2027.audit (
 id bigint generated always as identity primary key,
 action text not null, created_at timestamptz not null default now()
);
alter table familia_ferreira_2027.settings enable row level security;
alter table familia_ferreira_2027.participants enable row level security;
alter table familia_ferreira_2027.pairs enable row level security;
alter table familia_ferreira_2027.sessions enable row level security;
alter table familia_ferreira_2027.login_attempts enable row level security;
alter table familia_ferreira_2027.audit enable row level security;
revoke all on all tables in schema familia_ferreira_2027 from public,anon,authenticated;
revoke all on all sequences in schema familia_ferreira_2027 from public,anon,authenticated;
grant select,insert,update,delete on all tables in schema familia_ferreira_2027 to service_role;
grant usage,select on all sequences in schema familia_ferreira_2027 to service_role;

create or replace function familia_ferreira_2027.reply(code integer,payload jsonb)
returns jsonb language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('status',code,'data',payload);
$$;

create or replace function familia_ferreira_2027.random_below(bound integer)
returns integer language plpgsql volatile security invoker set search_path='' as $$
declare b bytea; n bigint; maximum bigint;
begin
 if bound<1 then raise exception 'invalid bound'; end if;
 maximum:=4294967296-(4294967296 % bound);
 loop
  b:=extensions.gen_random_bytes(4);
  n:=get_byte(b,0)::bigint*16777216+get_byte(b,1)::bigint*65536+get_byte(b,2)::bigint*256+get_byte(b,3);
  exit when n<maximum;
 end loop;
 return (n % bound)::integer;
end;
$$;

create or replace function familia_ferreira_2027.ensure_draw()
returns timestamptz language plpgsql volatile security invoker set search_path='' as $$
declare v_at timestamptz; v_ids integer[]; v_targets integer[]; i integer; j integer; swap integer; valid boolean;
begin
 select started_at into v_at from familia_ferreira_2027.settings where id=true for update;
 if v_at is not null then return v_at;end if;
 select array_agg(id::integer order by id) into v_ids from familia_ferreira_2027.participants;
 if cardinality(v_ids)<>14 then raise exception 'A lista deve conter os 14 participantes.';end if;
 loop
  v_targets:=v_ids;
  for i in reverse cardinality(v_ids)..2 loop
   j:=familia_ferreira_2027.random_below(i)+1;
   swap:=v_targets[i];v_targets[i]:=v_targets[j];v_targets[j]:=swap;
  end loop;
  valid:=true;
  for i in 1..cardinality(v_ids) loop if v_ids[i]=v_targets[i] then valid:=false;exit;end if;end loop;
  exit when valid;
 end loop;
 for i in 1..cardinality(v_ids) loop insert into familia_ferreira_2027.pairs(giver,receiver) values(v_ids[i],v_targets[i]);end loop;
 v_at:=now();update familia_ferreira_2027.settings set started_at=v_at where id=true;
 insert into familia_ferreira_2027.audit(action) values('Sorteio iniciado automaticamente no primeiro acesso válido');
 return v_at;
end;
$$;
revoke all on function familia_ferreira_2027.ensure_draw() from public,anon,authenticated;
grant execute on function familia_ferreira_2027.ensure_draw() to service_role;

-- Invoker-only RPC: anonymous/authenticated callers cannot invoke it or access tables.
-- Edge Function uses its built-in server credentials; this function validates app sessions.
create or replace function public.familia_ferreira_api(request jsonb)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare
 v_path text:=request->>'path'; v_method text:=request->>'method';
 v_input jsonb:=coalesce(request->'input','{}'::jsonb);
 v_token text:=coalesce(request->>'sessionToken',''); v_raw text;
 v_settings familia_ferreira_2027.settings%rowtype;
 v_session familia_ferreira_2027.sessions%rowtype;
 v_person familia_ferreira_2027.participants%rowtype;
 v_receiver familia_ferreira_2027.participants%rowtype;
 v_role text; v_count integer; v_key text; v_id integer;
 v_data jsonb; v_codes jsonb:='[]'::jsonb; v_code text;
 v_ids integer[]; v_targets integer[]; v_i integer; v_j integer; v_swap integer; v_valid boolean;
 v_age integer; v_at timestamptz; v_pass text; v_expected text;
begin
 if v_method not in ('GET','POST') or v_method is null or v_path is null or jsonb_typeof(v_input)<>'object' then
  return familia_ferreira_2027.reply(400,jsonb_build_object('error','Requisição inválida.'));
 end if;
 -- All mutations and reads share the event lock, keeping global draw and resets atomic.
 select * into v_settings from familia_ferreira_2027.settings where id=true for update;
 if v_path='/event' and v_method='GET' then
  select jsonb_agg(jsonb_build_object('id',id,'name',name) order by id) into v_data from familia_ferreira_2027.participants;
  return familia_ferreira_2027.reply(200,jsonb_build_object('participants',v_data,'pendingParticipants',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by id) from familia_ferreira_2027.participants where revealed_at is null),'[]'::jsonb),'startedAt',v_settings.started_at,'year',2027,'storageReady',true));
 end if;
 if v_path='/health' and v_method='GET' then return familia_ferreira_2027.reply(200,'{"ok":true}'::jsonb); end if;
 if v_path in ('/login','/admin/login') and v_method='POST' then
  if v_path='/admin/login' then v_key:='admin';
  else
   if coalesce(v_input->>'id','')!~'^[0-9]{1,3}$' then return familia_ferreira_2027.reply(401,jsonb_build_object('error','Nome ou ID incorreto.')); end if;
   v_id:=(v_input->>'id')::integer; v_key:='participant:'||v_id;
  end if;
  delete from familia_ferreira_2027.login_attempts where expires<now();
  insert into familia_ferreira_2027.login_attempts as attempts(key,count,expires) values(v_key,1,now()+interval '15 minutes')
   on conflict(key) do update set count=attempts.count+1 returning count into v_count;
  if v_count>60 then return familia_ferreira_2027.reply(429,jsonb_build_object('error','Muitas tentativas. Aguarde 15 minutos.')); end if;
  if v_path='/admin/login' then
   v_pass:=coalesce(v_input->>'password',''); v_expected:=v_settings.admin_code_hash;
   if length(v_pass)>72 or extensions.crypt(v_pass,v_expected)<>v_expected then return familia_ferreira_2027.reply(401,jsonb_build_object('error','ID do administrador incorreto.')); end if;
   v_role:='admin'; v_age:=28800; v_id:=null;
   insert into familia_ferreira_2027.audit(action) values('Login do organizador');
  else
   select * into v_person from familia_ferreira_2027.participants where id=v_id;
   v_pass:=upper(trim(coalesce(v_input->>'code','')));
   v_expected:=coalesce(v_person.code_hash,v_settings.admin_code_hash);
   if v_person.code_hash is null or length(v_pass)>72 or extensions.crypt(v_pass,v_expected)<>v_expected then return familia_ferreira_2027.reply(401,jsonb_build_object('error','Nome ou ID incorreto. Confira com o organizador.')); end if;
   perform familia_ferreira_2027.ensure_draw();
   update familia_ferreira_2027.participants set confirmed_at=coalesce(confirmed_at,now()) where id=v_id;
   v_role:='participant'; v_age:=604800;
  end if;
  v_raw:=encode(extensions.gen_random_bytes(32),'hex');
  delete from familia_ferreira_2027.sessions where expires<now();
  insert into familia_ferreira_2027.sessions(hash,role,participant_id,expires)
   values(encode(extensions.digest(v_raw,'sha256'),'hex'),v_role,v_id,now()+make_interval(secs=>v_age));
  return familia_ferreira_2027.reply(200,'{"ok":true}'::jsonb)||jsonb_build_object('session',jsonb_build_object('role',v_role,'token',v_raw,'maxAge',v_age));
 end if;
 v_role:=case when v_path like '/admin/%' then 'admin' else 'participant' end;
 if v_token!~'^[a-f0-9]{64}$' then return familia_ferreira_2027.reply(401,jsonb_build_object('error','Entre novamente para continuar.')); end if;
 select * into v_session from familia_ferreira_2027.sessions where hash=encode(extensions.digest(v_token,'sha256'),'hex') and role=v_role and expires>now();
 if not found then return familia_ferreira_2027.reply(401,jsonb_build_object('error','Entre novamente para continuar.')); end if;
 if v_path in ('/logout','/admin/logout') and v_method='POST' then
  delete from familia_ferreira_2027.sessions where hash=v_session.hash;
  return familia_ferreira_2027.reply(200,'{"ok":true}'::jsonb)||jsonb_build_object('session',jsonb_build_object('role',v_role,'token','','maxAge',0));
 end if;
 if v_role='participant' then
  select * into v_person from familia_ferreira_2027.participants where id=v_session.participant_id;
  if v_path='/me' and v_method='GET' then
   return familia_ferreira_2027.reply(200,jsonb_build_object('id',v_person.id,'name',v_person.name,'confirmed_at',v_person.confirmed_at,'revealed_at',v_person.revealed_at,'startedAt',v_settings.started_at));
  end if;
  if (v_path='/reveal' and v_method='POST') or (v_path='/result' and v_method='GET') then
   if v_method='POST' then v_settings.started_at:=familia_ferreira_2027.ensure_draw();end if;
   if v_settings.started_at is null then return familia_ferreira_2027.reply(409,jsonb_build_object('error','Entre novamente para revelar seu resultado.'));end if;
   if v_method='GET' and v_person.revealed_at is null then return familia_ferreira_2027.reply(409,jsonb_build_object('error','Gire sua roleta primeiro.')); end if;
   select p.* into v_receiver from familia_ferreira_2027.pairs pair join familia_ferreira_2027.participants p on p.id=pair.receiver where pair.giver=v_person.id;
   if not found then return familia_ferreira_2027.reply(409,jsonb_build_object('error','Sorteio indisponível.')); end if;
   v_at:=coalesce(v_person.revealed_at,now());
   if v_method='POST' then update familia_ferreira_2027.participants set revealed_at=v_at where id=v_person.id; end if;
   return familia_ferreira_2027.reply(200,jsonb_build_object('participant',v_person.name,'receiver',jsonb_build_object('id',v_receiver.id,'name',v_receiver.name),'revealedAt',v_at));
  end if;
 else
  if v_path='/admin/dashboard' and v_method='GET' then
   select jsonb_agg(jsonb_build_object('id',id,'name',name,'confirmed_at',confirmed_at,'revealed_at',revealed_at,'has_code',case when code_hash is null then 0 else 1 end) order by id) into v_data from familia_ferreira_2027.participants;
   return familia_ferreira_2027.reply(200,jsonb_build_object('participants',v_data,'startedAt',v_settings.started_at,'audit',coalesce((select jsonb_agg(to_jsonb(a) order by a.id desc) from (select id,action,created_at from familia_ferreira_2027.audit order by id desc limit 20) a),'[]'::jsonb)));
  end if;
  if v_path='/admin/results' then return familia_ferreira_2027.reply(403,jsonb_build_object('error','O painel acompanha somente participação. Os nomes sorteados não são exibidos ao organizador.'));end if;
  if v_method='POST' then
   if v_path='/admin/codes' then
    if v_input->>'id' is not null then
     if (v_input->>'id')!~'^[0-9]{1,3}$' then return familia_ferreira_2027.reply(404,jsonb_build_object('error','Participante não encontrado.')); end if;
     v_id:=(v_input->>'id')::integer;
     if not exists(select 1 from familia_ferreira_2027.participants where id=v_id) then return familia_ferreira_2027.reply(404,jsonb_build_object('error','Participante não encontrado.')); end if;
    end if;
    for v_person in select * from familia_ferreira_2027.participants where (v_id is not null and id=v_id) or (v_id is null and code_hash is null) order by id loop
     loop
      v_code:=upper(encode(extensions.gen_random_bytes(6),'hex'));
      exit when not exists(select 1 from familia_ferreira_2027.participants where id<>v_person.id and code_hash is not null and extensions.crypt(v_code,code_hash)=code_hash);
     end loop;
     update familia_ferreira_2027.participants set code_hash=extensions.crypt(v_code,extensions.gen_salt('bf',10)) where id=v_person.id;
     delete from familia_ferreira_2027.sessions where participant_id=v_person.id;
     v_codes:=v_codes||jsonb_build_array(jsonb_build_object('id',v_person.id,'name',v_person.name,'code',v_code));
    end loop;
    insert into familia_ferreira_2027.audit(action) values(case when v_id is null then 'IDs individuais gerados' else 'ID individual substituído' end);
    return familia_ferreira_2027.reply(200,v_codes);
   end if;
   if v_path='/admin/start' then
    if v_settings.started_at is not null then return familia_ferreira_2027.reply(409,jsonb_build_object('error','O sorteio já foi iniciado.'));end if;
    perform familia_ferreira_2027.ensure_draw();return familia_ferreira_2027.reply(200,'{"ok":true}'::jsonb);
   end if;
   if v_path='/admin/reset' then
    v_pass:=coalesce(v_input->>'password','');
    if coalesce(v_input->>'confirmation','')<>'INVALIDAR RESULTADOS' or length(v_pass)>72 or extensions.crypt(v_pass,v_settings.admin_code_hash)<>v_settings.admin_code_hash then return familia_ferreira_2027.reply(400,jsonb_build_object('error','Digite INVALIDAR RESULTADOS e confirme o ID do administrador.')); end if;
    delete from familia_ferreira_2027.pairs;
    update familia_ferreira_2027.settings set started_at=null where id=true;
    update familia_ferreira_2027.participants set revealed_at=null;
    delete from familia_ferreira_2027.sessions where role='participant';
    insert into familia_ferreira_2027.audit(action) values('Sorteio reiniciado: resultados e sessões anteriores invalidados');
    return familia_ferreira_2027.reply(200,'{"ok":true}'::jsonb);
   end if;
   if v_path='/admin/participants' then return familia_ferreira_2027.reply(403,jsonb_build_object('error','A lista é fixa: somente os 14 nomes informados pela família.'));end if;
  end if;
 end if;
 return familia_ferreira_2027.reply(404,jsonb_build_object('error','Operação não encontrada.'));
end;
$$;
revoke all on all functions in schema familia_ferreira_2027 from public,anon,authenticated;
grant execute on all functions in schema familia_ferreira_2027 to service_role;
revoke all on function public.familia_ferreira_api(jsonb) from public,anon,authenticated;
grant execute on function public.familia_ferreira_api(jsonb) to service_role;
notify pgrst,'reload schema';

-- Explicit deny policies complement revoked privileges and the private schema.
do $policies$
declare t text;
begin
 foreach t in array array['settings','participants','pairs','sessions','login_attempts','audit'] loop
  if not exists(select 1 from pg_policies where schemaname='familia_ferreira_2027' and tablename=t and policyname='deny_direct_access') then
   execute format('create policy deny_direct_access on familia_ferreira_2027.%I for all to anon,authenticated using(false) with check(false)',t);
  end if;
 end loop;
end;
$policies$;
