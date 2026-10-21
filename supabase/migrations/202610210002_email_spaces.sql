-- Execute após as três migrações anteriores. Não apaga registros.
-- Acesso deliberadamente sem verificação: saber o e-mail permite ler e alterar seus dados.
begin;
create table public.email_spaces (
 email text primary key check(email=lower(trim(email)) and length(email)<=254),
 owner_id uuid not null unique references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create table public.email_space_sessions (
 session_id uuid primary key references auth.users(id) on delete cascade,
 email text not null references public.email_spaces(email) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.email_spaces enable row level security;
alter table public.email_space_sessions enable row level security;
revoke all on public.email_spaces,public.email_space_sessions from public,anon,authenticated;
create index email_space_sessions_email_idx on public.email_space_sessions(email);

-- A sessão é técnica; o endereço informado não comprova identidade.
-- Estas tabelas só são acessíveis pelas funções abaixo, sem listagem de endereços.
create function public.nutria_user_id() returns uuid language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce((select s.owner_id from public.email_spaces s
 join public.email_space_sessions a on a.email=s.email where a.session_id=auth.uid()),auth.uid())
$$;
create function public.get_email_space() returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(
  (select jsonb_build_object('id',s.owner_id,'email',s.email) from public.email_spaces s
   join public.email_space_sessions a on a.email=s.email where a.session_id=auth.uid()),
  (select jsonb_build_object('id',u.id,'email',lower(trim(u.email))) from auth.users u
   where u.id=auth.uid() and nullif(trim(u.email),'') is not null)
 )
$$;
create function public.enter_email_space(address text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid=auth.uid(); normalized text=lower(trim(address)); target uuid; previous text;
begin
 if uid is null then raise exception 'Inicie uma sessão antes de entrar'; end if;
 if normalized is null or length(normalized)>254 or normalized !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  then raise exception 'Informe um endereço de e-mail válido'; end if;
 -- Serializa também por sessão: não permite vincular a mesma sessão a dois endereços.
 perform pg_advisory_xact_lock(hashtext('nutria-session-'||uid::text));
 select email into previous from public.email_space_sessions where session_id=uid;
 if previous is not null and previous<>normalized then raise exception 'Saia do espaço atual antes de usar outro e-mail'; end if;
 perform pg_advisory_xact_lock(hashtext('nutria-email-'||normalized));
 select owner_id into target from public.email_spaces where email=normalized;
 if target is null then
  -- Preserva contas e registros criados pelo fluxo antigo de link de e-mail.
  select id into target from auth.users where lower(trim(email))=normalized limit 1;
  target=coalesce(target,uid);
  insert into public.email_spaces(email,owner_id) values(normalized,target);
 end if;
 insert into public.email_space_sessions(session_id,email) values(uid,normalized) on conflict(session_id) do nothing;
 return jsonb_build_object('id',target,'email',normalized);
end $$;
revoke all on function public.nutria_user_id(),public.get_email_space(),public.enter_email_space(text) from public,anon;
grant execute on function public.nutria_user_id(),public.get_email_space(),public.enter_email_space(text) to authenticated;

-- RLS separa os espaços escolhidos; não verifica quem conhece o endereço.
do $$ declare t text; begin
 foreach t in array array['profiles','foods','meals','food_entries','saved_meals','saved_meal_items','daily_goals','weight_logs','water_logs','local_imports'] loop
  if t='local_imports' then execute format('drop policy own_imports on public.%I',t);
  else execute format('drop policy own_data on public.%I',t); end if;
  execute format('create policy own_data on public.%I for all to authenticated using ((select public.nutria_user_id())=user_id) with check ((select public.nutria_user_id())=user_id)',t);
 end loop;
end $$;

create or replace function public.initialize_user(initial_name text default '') returns void language plpgsql security invoker set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtext(public.nutria_user_id()::text));
 insert into public.profiles(id,user_id,name) values(public.nutria_user_id(),public.nutria_user_id(),left(trim(coalesce(initial_name,'')),100)) on conflict do nothing;
 if not exists(select 1 from public.meals where user_id=public.nutria_user_id()) then
  insert into public.meals(user_id,name,sort_order) values(public.nutria_user_id(),'Café da manhã',0),(public.nutria_user_id(),'Almoço',1),(public.nutria_user_id(),'Lanche',2),(public.nutria_user_id(),'Jantar',3);
 end if;
end $$;
-- Salva receita e itens em uma transação.
create or replace function public.save_recipe(recipe_id uuid,recipe_name text,items jsonb) returns void language plpgsql security invoker set search_path=public as $$
begin
 insert into public.saved_meals(id,user_id,name) values(recipe_id,public.nutria_user_id(),recipe_name)
 on conflict(id) do update set name=excluded.name;
 delete from public.saved_meal_items where saved_meal_id=recipe_id and user_id=public.nutria_user_id();
 insert into public.saved_meal_items(user_id,saved_meal_id,food_id,quantity,unit)
 select public.nutria_user_id(),recipe_id,(i->>'food_id')::uuid,(i->>'quantity')::numeric,i->>'unit' from jsonb_array_elements(items) i;
end $$;
revoke all on function public.initialize_user(text) from public;
revoke all on function public.save_recipe(uuid,text,jsonb) from public;
grant execute on function public.initialize_user(text) to authenticated;
grant execute on function public.save_recipe(uuid,text,jsonb) to authenticated;

create or replace function public.transfer_local_data(payload jsonb,import_id uuid) returns jsonb
 language plpgsql security invoker set search_path=public as $$
declare
 uid uuid=public.nutria_user_id(); item jsonb; p jsonb; source text; target uuid; inserted uuid;
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
