-- Name replacement only: preserve the participant ID and current draw.
begin;
select id from familia_ferreira_2027.settings where id=true for update;
with renamed as (
 update familia_ferreira_2027.participants set name='Agatha' where name='Noah' returning id
)
insert into familia_ferreira_2027.audit(action)
 select 'Nome atualizado: Noah substituído por Agatha, mantendo os 14 participantes' from renamed;
commit;
