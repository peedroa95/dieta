-- Execute uma vez no SQL Editor do seu projeto Supabase.
begin;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 user_id uuid not null unique references auth.users(id) on delete cascade,
 name text not null default '', age integer check(age between 1 and 120), sex text not null default '',
 height numeric check(height>0), body_weight numeric check(body_weight>0), body_fat numeric check(body_fat between 0 and 100),
 activity numeric not null default 1.2 check(activity between 1 and 2.5), training integer not null default 0 check(training between 0 and 7),
 objective text not null default 'maintain' check(objective in ('lose','maintain','gain')), timezone text not null default 'America/Fortaleza',
 created_at timestamptz not null default now(), check(id=user_id)
);
create table public.foods (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(trim(name))>0), brand text not null default '', category text not null default 'Outros',
 unit text not null check(unit in ('g','ml','porção')), reference numeric not null check(reference>0), portion_weight numeric check(portion_weight>0),
 calories numeric not null check(calories>=0), protein numeric not null check(protein>=0), carbs numeric not null check(carbs>=0), fat numeric not null check(fat>=0),
 fiber numeric not null default 0 check(fiber>=0), sugar numeric not null default 0 check(sugar>=0),
 saturated_fat numeric not null default 0 check(saturated_fat>=0), trans_fat numeric not null default 0 check(trans_fat>=0),
 sodium numeric not null default 0 check(sodium>=0), cholesterol numeric not null default 0 check(cholesterol>=0),
 notes text not null default '', favorite boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id)
);
create table public.meals (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(trim(name))>0),sort_order integer not null default 0,created_at timestamptz not null default now(),unique(id,user_id)
);
create table public.food_entries (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 food_id uuid references public.foods(id) on delete set null,
 meal_id uuid not null, date date not null,quantity numeric not null check(quantity>0),unit text not null check(unit in ('g','ml','porção')),
 snapshot jsonb not null, nutrition jsonb not null,
 calories_recorded numeric generated always as ((nutrition->>'calories')::numeric) stored,
 protein_recorded numeric generated always as ((nutrition->>'protein')::numeric) stored,
 carbs_recorded numeric generated always as ((nutrition->>'carbs')::numeric) stored,
 fat_recorded numeric generated always as ((nutrition->>'fat')::numeric) stored,
 created_at timestamptz not null default now(),
 foreign key(meal_id,user_id) references public.meals(id,user_id)
);
create table public.saved_meals (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(trim(name))>0),created_at timestamptz not null default now(),unique(id,user_id)
);
create table public.saved_meal_items (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 saved_meal_id uuid not null,food_id uuid not null,quantity numeric not null check(quantity>0),unit text not null check(unit in ('g','ml','porção')),
 created_at timestamptz not null default now(),
 foreign key(saved_meal_id,user_id) references public.saved_meals(id,user_id) on delete cascade,
 foreign key(food_id,user_id) references public.foods(id,user_id) on delete cascade
);
create table public.daily_goals (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,date date not null,
 calories numeric not null check(calories>0),protein numeric not null check(protein>=0),carbs numeric not null check(carbs>=0),fat numeric not null check(fat>=0),water numeric not null check(water>0),
 created_at timestamptz not null default now(),unique(user_id,date)
);
create table public.weight_logs (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 date date not null,weight numeric not null check(weight>0 and weight<=500),notes text not null default '',created_at timestamptz not null default now(),unique(user_id,date)
);
create table public.water_logs (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 date date not null,amount numeric not null check(amount>0),created_at timestamptz not null default now()
);
-- RLS: nenhuma chave administrativa é necessária no navegador.
do $$ declare t text; begin
 foreach t in array array['profiles','foods','meals','food_entries','saved_meals','saved_meal_items','daily_goals','weight_logs','water_logs'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy own_data on public.%I for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',t);
  execute format('create index %I on public.%I(user_id)',t||'_owner_idx',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('revoke all on public.%I from anon',t);
 end loop;
end $$;
create index entries_day_idx on public.food_entries(user_id,date,meal_id);
create index water_day_idx on public.water_logs(user_id,date);
create index weight_day_idx on public.weight_logs(user_id,date);
create index food_search_idx on public.foods(user_id,lower(name));
create index saved_items_idx on public.saved_meal_items(saved_meal_id);

-- Calcula no PostgreSQL com NUMERIC e preserva o snapshot original em edições.
create function public.calculate_entry() returns trigger language plpgsql set search_path=public as $$
declare f jsonb; ratio numeric; key text; result jsonb='{}'; begin
 if TG_OP='INSERT' then
  select to_jsonb(foods) into f from public.foods where id=new.food_id and user_id=new.user_id;
  if f is null then raise exception 'Alimento indisponível para este usuário'; end if;
 else
  if new.user_id<>old.user_id or new.id<>old.id then raise exception 'Identidade do registro imutável'; end if;
  if new.food_id is distinct from old.food_id and new.food_id is not null then raise exception 'Não é possível trocar o alimento de um registro'; end if;
  f=old.snapshot;
 end if;
 if new.quantity<=0 then raise exception 'Quantidade deve ser positiva'; end if;
 if new.unit=f->>'unit' then ratio=new.quantity/(f->>'reference')::numeric;
 elsif f->>'unit'='porção' and new.unit='g' and (f->>'portion_weight')::numeric>0 then
  ratio=new.quantity/(f->>'portion_weight')::numeric/(f->>'reference')::numeric;
 else raise exception 'Unidades incompatíveis'; end if;
 foreach key in array array['calories','protein','carbs','fat','fiber','sugar','saturated_fat','trans_fat','sodium','cholesterol'] loop
  result=result||jsonb_build_object(key,(f->>key)::numeric*ratio);
 end loop;
 new.snapshot=f; new.nutrition=result; return new;
end $$;
create trigger entry_nutrition before insert or update on public.food_entries for each row execute function public.calculate_entry();
create function public.update_food_timestamp() returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end $$;
create trigger food_timestamp before update on public.foods for each row execute function public.update_food_timestamp();

-- Inicialização repetível e atômica, executada com as permissões do usuário.
create function public.initialize_user(initial_name text default '') returns void language plpgsql security invoker set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 insert into public.profiles(id,user_id,name) values(auth.uid(),auth.uid(),left(trim(coalesce(initial_name,'')),100)) on conflict do nothing;
 if not exists(select 1 from public.meals where user_id=auth.uid()) then
  insert into public.meals(user_id,name,sort_order) values(auth.uid(),'Café da manhã',0),(auth.uid(),'Almoço',1),(auth.uid(),'Lanche',2),(auth.uid(),'Jantar',3);
 end if;
end $$;
-- Salva receita e itens em uma transação.
create function public.save_recipe(recipe_id uuid,recipe_name text,items jsonb) returns void language plpgsql security invoker set search_path=public as $$
begin
 insert into public.saved_meals(id,user_id,name) values(recipe_id,auth.uid(),recipe_name)
 on conflict(id) do update set name=excluded.name;
 delete from public.saved_meal_items where saved_meal_id=recipe_id and user_id=auth.uid();
 insert into public.saved_meal_items(user_id,saved_meal_id,food_id,quantity,unit)
 select auth.uid(),recipe_id,(i->>'food_id')::uuid,(i->>'quantity')::numeric,i->>'unit' from jsonb_array_elements(items) i;
end $$;
revoke all on function public.initialize_user(text) from public;
revoke all on function public.save_recipe(uuid,text,jsonb) from public;
grant execute on function public.initialize_user(text) to authenticated;
grant execute on function public.save_recipe(uuid,text,jsonb) to authenticated;
commit;
