-- Execute depois das duas migrações anteriores. Preserva os dados existentes.
begin;
create table public.local_imports (
 source_id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 counts jsonb not null default '{}',
 created_at timestamptz not null default now(),
 unique(source_id,user_id)
);
alter table public.local_imports enable row level security;
create policy own_imports on public.local_imports for all to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update on public.local_imports to authenticated;
revoke all on public.local_imports from anon;
create index local_imports_owner_idx on public.local_imports(user_id);
alter table public.food_entries add column import_source_id uuid;
alter table public.food_entries add constraint entry_import_owner_fk foreign key(import_source_id,user_id)
 references public.local_imports(source_id,user_id);

-- Consumos importados preservam seu snapshot, que também é validado e recalculado.
-- Consumos normais continuam obtendo todos os nutrientes do cadastro no servidor.
create or replace function public.calculate_entry() returns trigger language plpgsql set search_path=public as $$
declare f jsonb; ratio numeric; key text; result jsonb='{}'; begin
 if TG_OP='INSERT' then
  if new.import_source_id is not null then
   if not exists(select 1 from public.local_imports where source_id=new.import_source_id and user_id=new.user_id)
    then raise exception 'Origem da transferência indisponível para este usuário'; end if;
   if new.food_id is not null and not exists(select 1 from public.foods where id=new.food_id and user_id=new.user_id)
    then raise exception 'Alimento indisponível para este usuário'; end if;
   f=new.snapshot;
  else
   select to_jsonb(foods) into f from public.foods where id=new.food_id and user_id=new.user_id;
   if f is null then raise exception 'Alimento indisponível para este usuário'; end if;
  end if;
 else
  if new.user_id<>old.user_id or new.id<>old.id or new.import_source_id is distinct from old.import_source_id
   then raise exception 'Identidade do registro imutável'; end if;
  if new.food_id is distinct from old.food_id and new.food_id is not null then raise exception 'Não é possível trocar o alimento de um registro'; end if;
  f=old.snapshot;
 end if;
 if jsonb_typeof(f) is distinct from 'object' or nullif(trim(f->>'name'),'') is null or
    (f->>'unit') not in ('g','ml','porção') or jsonb_typeof(f->'reference') is distinct from 'number' or (f->>'reference')::numeric<=0
  then raise exception 'Referência nutricional inválida na transferência'; end if;
 if new.quantity<=0 then raise exception 'Quantidade deve ser positiva'; end if;
 if new.unit=f->>'unit' then ratio=new.quantity/(f->>'reference')::numeric;
 elsif f->>'unit'='porção' and new.unit='g' and (f->>'portion_weight')::numeric>0 then
  ratio=new.quantity/(f->>'portion_weight')::numeric/(f->>'reference')::numeric;
 else raise exception 'Unidades incompatíveis'; end if;
 foreach key in array array['calories','protein','carbs','fat','fiber','sugar','saturated_fat','trans_fat','sodium','cholesterol'] loop
  if jsonb_typeof(f->key) is distinct from 'number' or (f->>key)::numeric<0
   then raise exception 'Nutriente inválido na transferência: %',key; end if;
  result=result||jsonb_build_object(key,(f->>key)::numeric*ratio);
 end loop;
 new.snapshot=f||jsonb_build_object('user_id',new.user_id);new.nutrition=result;return new;
end $$;

create function public.import_row_id(owner_id uuid,source_id uuid,kind text,old_id uuid)
 returns uuid language sql immutable strict set search_path=public as $$
 select md5(owner_id::text||source_id::text||kind||old_id::text)::uuid
$$;

-- Operação atômica e idempotente. RLS e chaves compostas continuam em vigor.
create function public.transfer_local_data(payload jsonb,import_id uuid) returns jsonb
 language plpgsql security invoker set search_path=public as $$
declare
 uid uuid=auth.uid(); item jsonb; p jsonb; source text; target uuid; inserted uuid;
 meal_map jsonb='{}';food_map jsonb='{}';recipe_map jsonb='{}';
 food_count integer=0;entry_count integer=0;meal_count integer=0;water_count integer=0;weight_count integer=0;
 goal_count integer=0;recipe_count integer=0;item_count integer=0;changed integer=0;n integer=0;result jsonb;
begin
 if uid is null or import_id is null then raise exception 'Entre na sua conta para transferir os dados'; end if;
 if jsonb_typeof(payload) is distinct from 'object' then raise exception 'Arquivo de transferência inválido'; end if;
 foreach source in array array['foods','meals','food_entries','daily_goals','weight_logs','water_logs','saved_meals','saved_meal_items','profiles'] loop
  if jsonb_typeof(payload->source) is distinct from 'array' then raise exception 'Lista ausente ou inválida: %',source; end if;
  n=n+jsonb_array_length(payload->source);
 end loop;
 if n>5000 then raise exception 'Transfira até 5000 registros por arquivo'; end if;
 perform pg_advisory_xact_lock(hashtext('nutria-transfer-'||import_id::text));
 insert into public.local_imports(source_id,user_id) values(import_id,uid) on conflict(source_id) do nothing returning source_id into inserted;
 if inserted is null then
  select counts into result from public.local_imports where source_id=import_id and user_id=uid;
  if result is null then raise exception 'Estes dados já foram transferidos para outra conta'; end if;
  return result||jsonb_build_object('already_imported',true);
 end if;
 for item in select value from jsonb_array_elements(payload->'meals') loop
  source=(item->>'id')::uuid::text;
  select id into target from public.meals where user_id=uid and lower(trim(name))=lower(trim(item->>'name')) order by id limit 1;
  if target is null then
   target=public.import_row_id(uid,import_id,'meal',source::uuid);
   insert into public.meals(id,user_id,name,sort_order) values(target,uid,item->>'name',coalesce((item->>'sort_order')::integer,0));meal_count=meal_count+1;
  end if;
  meal_map=meal_map||jsonb_build_object(source,target);
 end loop;
 for item in select value from jsonb_array_elements(payload->'foods') loop
  source=(item->>'id')::uuid::text;target=null;
  select id into target from public.foods where id=source::uuid and user_id=uid;
  if target is null and nullif(item->>'barcode','') is not null then
   select id into target from public.foods where user_id=uid and lpad(barcode,14,'0')=lpad(item->>'barcode',14,'0') limit 1;
  elsif target is null then
   select id into target from public.foods where user_id=uid and lower(trim(name))=lower(trim(item->>'name')) and lower(trim(brand))=lower(trim(coalesce(item->>'brand',''))) order by id limit 1;
  end if;
  if target is null then
   target=public.import_row_id(uid,import_id,'food',source::uuid);
   insert into public.foods(id,user_id,name,brand,category,unit,reference,portion_weight,calories,protein,carbs,fat,fiber,sugar,saturated_fat,trans_fat,sodium,cholesterol,notes,favorite,barcode,source_url,unknown_nutrients)
    select target,uid,f.name,coalesce(f.brand,''),coalesce(f.category,'Outros'),f.unit,f.reference,f.portion_weight,f.calories,f.protein,f.carbs,f.fat,
     coalesce(f.fiber,0),coalesce(f.sugar,0),coalesce(f.saturated_fat,0),coalesce(f.trans_fat,0),coalesce(f.sodium,0),coalesce(f.cholesterol,0),coalesce(f.notes,''),coalesce(f.favorite,false),nullif(f.barcode,''),
     case when f.source_url ~ '^https://world\.openfoodfacts\.org/product/[0-9]+$' then f.source_url else null end,coalesce(f.unknown_nutrients,'{}')
    from jsonb_populate_record(null::public.foods,item) f;
   food_count=food_count+1;
  end if;
  food_map=food_map||jsonb_build_object(source,target);
 end loop;
 for item in select value from jsonb_array_elements(payload->'saved_meals') loop
  source=(item->>'id')::uuid::text;
  select id into target from public.saved_meals where id=source::uuid and user_id=uid;
  if target is null then
   target=public.import_row_id(uid,import_id,'recipe',source::uuid);
   insert into public.saved_meals(id,user_id,name) values(target,uid,item->>'name');recipe_count=recipe_count+1;
  end if;
  recipe_map=recipe_map||jsonb_build_object(source,target);
 end loop;
 for item in select value from jsonb_array_elements(payload->'saved_meal_items') loop
  if exists(select 1 from public.saved_meal_items where id=(item->>'id')::uuid and user_id=uid) then continue; end if;
  insert into public.saved_meal_items(id,user_id,saved_meal_id,food_id,quantity,unit)
   values(public.import_row_id(uid,import_id,'recipe-item',(item->>'id')::uuid),uid,(recipe_map->>(item->>'saved_meal_id'))::uuid,(food_map->>(item->>'food_id'))::uuid,(item->>'quantity')::numeric,item->>'unit');
  item_count=item_count+1;
 end loop;
 for item in select value from jsonb_array_elements(payload->'food_entries') loop
  if exists(select 1 from public.food_entries where id=(item->>'id')::uuid and user_id=uid) then continue; end if;
  insert into public.food_entries(id,user_id,food_id,meal_id,date,quantity,unit,snapshot,nutrition,import_source_id)
   values(public.import_row_id(uid,import_id,'entry',(item->>'id')::uuid),uid,(food_map->>(item->>'food_id'))::uuid,(meal_map->>(item->>'meal_id'))::uuid,(item->>'date')::date,(item->>'quantity')::numeric,item->>'unit',item->'snapshot','{}',import_id);
  entry_count=entry_count+1;
 end loop;
 for item in select value from jsonb_array_elements(payload->'water_logs') loop
  if exists(select 1 from public.water_logs where id=(item->>'id')::uuid and user_id=uid) then continue; end if;
  insert into public.water_logs(id,user_id,date,amount) values(public.import_row_id(uid,import_id,'water',(item->>'id')::uuid),uid,(item->>'date')::date,(item->>'amount')::numeric);water_count=water_count+1;
 end loop;
 for item in select value from jsonb_array_elements(payload->'weight_logs') loop
  insert into public.weight_logs(id,user_id,date,weight,notes) values(public.import_row_id(uid,import_id,'weight',(item->>'id')::uuid),uid,(item->>'date')::date,(item->>'weight')::numeric,coalesce(item->>'notes','')) on conflict(user_id,date) do nothing;
  get diagnostics changed=row_count;weight_count=weight_count+changed;
 end loop;
 for item in select value from jsonb_array_elements(payload->'daily_goals') loop
  insert into public.daily_goals(id,user_id,date,calories,protein,carbs,fat,water) values(public.import_row_id(uid,import_id,'goal',(item->>'id')::uuid),uid,(item->>'date')::date,(item->>'calories')::numeric,(item->>'protein')::numeric,(item->>'carbs')::numeric,(item->>'fat')::numeric,(item->>'water')::numeric) on conflict(user_id,date) do nothing;
  get diagnostics changed=row_count;goal_count=goal_count+changed;
 end loop;
 p=payload->'profiles'->0;
 if p is not null then
  update public.profiles set name=coalesce(p->>'name',''),age=(p->>'age')::integer,sex=coalesce(p->>'sex',''),height=(p->>'height')::numeric,body_weight=(p->>'body_weight')::numeric,body_fat=(p->>'body_fat')::numeric,activity=coalesce((p->>'activity')::numeric,1.2),training=coalesce((p->>'training')::integer,0),objective=coalesce(p->>'objective','maintain'),timezone=coalesce(p->>'timezone','America/Fortaleza')
   where user_id=uid and name='';
 end if;
 result=jsonb_build_object('foods',food_count,'food_entries',entry_count,'meals',meal_count,'water_logs',water_count,'weight_logs',weight_count,'daily_goals',goal_count,'saved_meals',recipe_count,'saved_meal_items',item_count,'already_imported',false);
 update public.local_imports set counts=result where source_id=import_id and user_id=uid;
 return result;
end $$;
revoke all on function public.transfer_local_data(jsonb,uuid) from public;
grant execute on function public.transfer_local_data(jsonb,uuid) to authenticated;
commit;
