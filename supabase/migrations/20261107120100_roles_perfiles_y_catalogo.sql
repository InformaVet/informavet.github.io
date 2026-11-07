-- Roles (usuario / admin), perfiles protegidos y catálogo editable solo por admins.
--
-- ATENCIÓN: este script reemplaza las POLÍTICAS RLS (no los datos) de estas tablas:
--   perfiles (privado) · catálogo y datos de referencia: tipo_animal, raza, categoria,
--   guia_cuidado, tip_cuidado, alimento, peso_saludable, region, comuna, especialidad,
--   veterinaria (lectura pública; escritura solo admin) · datos personales del modelo ER:
--   persona, medico_animal, consulta, mascota_persona (cerrados a la API: la web no los usa;
--   desde el SQL Editor siguen funcionando igual).
-- Ninguna tabla se borra ni se modifica su contenido.
--
-- El login por RUT deja de leer la tabla perfiles desde el navegador: ahora lo resuelve
-- la Edge Function `login-rut`. Despliega las funciones antes de subir el front nuevo.

-- ---------- perfiles: rol y estado ----------

alter table public.perfiles add column if not exists rol text not null default 'usuario';
alter table public.perfiles add column if not exists activo boolean not null default true;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'perfiles_rol_valido' and conrelid = 'public.perfiles'::regclass
  ) then
    alter table public.perfiles
      add constraint perfiles_rol_valido check (rol in ('usuario', 'admin'));
  end if;
end $$;

create unique index if not exists perfiles_rut_unico on public.perfiles (rut);

-- ---------- es_admin() ----------
-- security definer: consulta perfiles saltándose RLS, así las políticas pueden usarla
-- sin caer en recursión. El rol sale de la tabla, nunca de claims editables por el usuario.

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfiles p
    where p.id = (select auth.uid()) and p.rol = 'admin' and p.activo
  );
$$;

revoke all on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated, service_role;

-- ---------- perfil automático al registrarse ----------
-- Lee nombre y rut de los metadatos que envía signUp(). Funciona aunque el correo
-- aún no esté confirmado (en ese momento todavía no hay sesión en el navegador).

create or replace function public.crear_perfil_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfiles (id, nombre, rut, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', ''),
    new.raw_user_meta_data ->> 'rut',
    new.email
  )
  on conflict (id) do nothing;
  return new;
exception
  when not_null_violation then
    raise warning 'No se pudo crear el perfil de %: faltan datos (nombre/rut)', new.id;
    return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil_nuevo_usuario();

-- ---------- limpiar políticas anteriores ----------

do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'perfiles', 'tipo_animal', 'raza', 'categoria', 'guia_cuidado', 'tip_cuidado',
        'alimento', 'peso_saludable', 'region', 'comuna', 'especialidad', 'veterinaria',
        'persona', 'medico_animal', 'consulta', 'mascota_persona'
      )
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ---------- perfiles ----------
-- Cada usuario ve solo su fila; los admin ven todas. Nadie desde el navegador puede
-- insertar, borrar ni cambiar rol/activo/rut/email (solo el nombre propio).

alter table public.perfiles enable row level security;

create policy perfiles_lectura on public.perfiles
  for select to authenticated
  using (id = (select auth.uid()) or public.es_admin());

create policy perfiles_edicion_propia on public.perfiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke all on public.perfiles from anon, authenticated;
grant select on public.perfiles to authenticated;
grant update (nombre) on public.perfiles to authenticated;
grant all on public.perfiles to service_role;

-- ---------- catálogo: lectura pública, escritura solo admin ----------

do $$
declare
  t text;
begin
  foreach t in array array[
    'tipo_animal', 'raza', 'categoria', 'guia_cuidado', 'tip_cuidado', 'alimento', 'peso_saludable',
    'region', 'comuna', 'especialidad', 'veterinaria'
  ]
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_lectura', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.es_admin())', t || '_alta', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.es_admin()) with check (public.es_admin())', t || '_edicion', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.es_admin())', t || '_baja', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- ---------- datos personales del modelo ER: cerrados a la API ----------
-- Contienen RUT, teléfonos y direcciones. La web no los usa, así que con RLS activado y sin
-- políticas nadie puede leerlos con la clave pública. Desde el SQL Editor siguen accesibles.

do $$
declare
  t text;
begin
  foreach t in array array['persona', 'medico_animal', 'consulta', 'mascota_persona']
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- Si "id" de guías y tips es serial, el rol authenticated necesita usar su secuencia.
do $$
declare
  t text;
  seq text;
begin
  foreach t in array array['guia_cuidado', 'tip_cuidado']
  loop
    seq := pg_get_serial_sequence('public.' || t, 'id');
    if seq is not null then
      execute format('grant usage, select on sequence %s to authenticated', seq);
    end if;
  end loop;
end $$;

-- ---------- uso de la IA (límite por usuario) ----------

create table if not exists public.uso_ia (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  creado_en timestamptz not null default now()
);

create index if not exists uso_ia_user_fecha_idx on public.uso_ia (user_id, creado_en desc);

alter table public.uso_ia enable row level security;
revoke all on public.uso_ia from anon, authenticated;
grant all on public.uso_ia to service_role;

-- ---------- auditoría de acciones de administradores ----------

create table if not exists public.auditoria_admin (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users (id) on delete set null,
  admin_email text,
  accion text not null,
  objetivo_id uuid,
  objetivo_email text,
  creado_en timestamptz not null default now()
);

create index if not exists auditoria_admin_fecha_idx on public.auditoria_admin (creado_en desc);

alter table public.auditoria_admin enable row level security;

drop policy if exists auditoria_lectura_admin on public.auditoria_admin;
create policy auditoria_lectura_admin on public.auditoria_admin
  for select to authenticated using (public.es_admin());

revoke all on public.auditoria_admin from anon, authenticated;
grant select on public.auditoria_admin to authenticated;
grant all on public.auditoria_admin to service_role;

-- ---------- primer administrador ----------
-- Los admin NO se pueden crear desde el sitio. Después de registrarte normalmente,
-- ejecuta en el SQL Editor (cambiando el correo):
--
--   update public.perfiles set rol = 'admin' where email = 'tu-correo@ejemplo.com';
