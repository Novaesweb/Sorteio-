-- One-time authorized exception. Preserve every other pair and all access IDs.
lock table familia_ferreira_2027.settings in exclusive mode;
create temp table before_iris_exception on commit drop as select * from familia_ferreira_2027.pairs;
alter table familia_ferreira_2027.pairs drop constraint pairs_receiver_key;
alter table familia_ferreira_2027.pairs add column receiver_slot smallint not null default 1;
alter table familia_ferreira_2027.pairs add constraint pairs_receiver_slot_check check(receiver_slot in (1,2));
alter table familia_ferreira_2027.pairs add constraint pairs_receiver_slot_unique unique(receiver,receiver_slot);
alter table familia_ferreira_2027.pairs add constraint pairs_second_slot_iris check(receiver_slot=1 or receiver=7);
update familia_ferreira_2027.pairs set receiver=(select id from familia_ferreira_2027.participants where name='Iris Ferreira'),receiver_slot=2
where receiver=(select id from familia_ferreira_2027.participants where name='Erick');
do $$
begin
 assert (select count(*) from familia_ferreira_2027.pairs where receiver=7)=2,'Iris must have two givers';
 assert not exists(select 1 from familia_ferreira_2027.pairs where receiver=12),'Erick must not remain a recipient';
 assert (select count(*) from familia_ferreira_2027.pairs)=14,'Preserve all givers';
 assert (select count(*) from before_iris_exception old join familia_ferreira_2027.pairs p using(giver) where old.receiver<>p.receiver)=1,'Only the Erick recipient may change';
 assert not exists(select 1 from before_iris_exception old join familia_ferreira_2027.pairs p using(giver) where old.receiver<>12 and old.receiver<>p.receiver),'Preserve other results';
end $$;
insert into familia_ferreira_2027.audit(action) values('Exceção autorizada: destinatário Erick substituído por Iris Ferreira; Iris recebe dois presentes. Demais pares e IDs preservados. Organizador fará os avisos pelo WhatsApp.');
create or replace function familia_ferreira_2027.ensure_draw()
returns timestamptz language plpgsql volatile security invoker set search_path='' as $$
declare v_at timestamptz; v_ids integer[]; v_targets integer[]; i integer; j integer; swap integer; valid boolean; iris_id integer; erick_id integer;
begin
 select started_at into v_at from familia_ferreira_2027.settings where id=true for update;
 if v_at is not null then return v_at;end if;
 select array_agg(id::integer order by id) into v_ids from familia_ferreira_2027.participants;
 if cardinality(v_ids)<>14 then raise exception 'A lista deve conter os 14 participantes.';end if;
 select id into strict iris_id from familia_ferreira_2027.participants where name='Iris Ferreira';
 select id into strict erick_id from familia_ferreira_2027.participants where name='Erick';
 loop
  v_targets:=array_replace(v_ids,erick_id,iris_id);
  for i in reverse cardinality(v_ids)..2 loop
   j:=familia_ferreira_2027.random_below(i)+1;
   swap:=v_targets[i];v_targets[i]:=v_targets[j];v_targets[j]:=swap;
  end loop;
  valid:=true;
  for i in 1..cardinality(v_ids) loop if v_ids[i]=v_targets[i] then valid:=false;exit;end if;end loop;
  exit when valid;
 end loop;
 for i in 1..cardinality(v_ids) loop
  insert into familia_ferreira_2027.pairs(giver,receiver,receiver_slot) values(v_ids[i],v_targets[i],1+(select count(*) from familia_ferreira_2027.pairs where receiver=v_targets[i]));
 end loop;
 v_at:=now();update familia_ferreira_2027.settings set started_at=v_at where id=true;
 insert into familia_ferreira_2027.audit(action) values('Sorteio iniciado automaticamente no primeiro acesso válido');
 return v_at;
end;
$$;
revoke all on function familia_ferreira_2027.ensure_draw() from public,anon,authenticated;
grant execute on function familia_ferreira_2027.ensure_draw() to service_role;

