-- Execute depois de 202610200001_initial.sql. Não altera os registros existentes.
begin;
alter table public.foods add column barcode text;
alter table public.foods add column source_url text;
alter table public.foods add column unknown_nutrients text[] not null default '{}';
create function public.valid_gtin(code text) returns boolean language plpgsql immutable strict set search_path=public as $$
declare i integer; weight integer=3; total integer=0; begin
 if code !~ '^([0-9]{8}|[0-9]{12}|[0-9]{13}|[0-9]{14})$' or code ~ '^0+$' then return false; end if;
 for i in reverse length(code)-1..1 loop
  total=total+substring(code from i for 1)::integer*weight;
  weight=case when weight=3 then 1 else 3 end;
 end loop;
 return (10-total%10)%10=right(code,1)::integer;
end $$;
alter table public.foods add constraint barcode_valid check(barcode is null or public.valid_gtin(barcode));
alter table public.foods add constraint unknown_nutrients_optional check(unknown_nutrients <@ array['fiber','sugar','saturated_fat','trans_fat','sodium','cholesterol']::text[]);
create unique index foods_owner_barcode_idx on public.foods(user_id,lpad(barcode,14,'0')) where barcode is not null;
commit;
