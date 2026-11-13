-- Verificación profesional del contenido (guías y tips).
--
-- Cada guía/tip tiene un estado "verificado". Todo el contenido existente queda como
-- NO verificado. Solo una cuenta admin marcada como `verificador` (la profesional) puede
-- cambiar ese estado. Reglas, aplicadas en la base de datos para que no se puedan saltar:
--   * Un registro nuevo siempre nace sin verificar.
--   * Si se edita el contenido de uno verificado, vuelve a "no verificado" (la verificación
--     avalaba un texto que ya no existe).
--   * Quién y cuándo verificó lo fija el servidor; el navegador no puede falsearlo.
--   * Cada verificación, retiro e invalidación queda en auditoria_admin.

-- ---------- perfiles: quién puede verificar ----------

alter table public.perfiles add column if not exists verificador boolean not null default false;

create or replace function public.es_verificador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfiles p
    where p.id = (select auth.uid()) and p.rol = 'admin' and p.activo and p.verificador
  );
$$;

revoke all on function public.es_verificador() from public, anon;
grant execute on function public.es_verificador() to authenticated, service_role;

-- ---------- auditoria_admin: ahora también registra acciones sobre contenido ----------

alter table public.auditoria_admin add column if not exists objeto_tipo text;
alter table public.auditoria_admin add column if not exists objeto_id text;
alter table public.auditoria_admin add column if not exists detalle text;

-- ---------- columnas de verificación ----------

alter table public.guia_cuidado add column if not exists verificado boolean not null default false;
alter table public.guia_cuidado add column if not exists verificado_por uuid references auth.users (id) on delete set null;
alter table public.guia_cuidado add column if not exists verificado_en timestamptz;

alter table public.tip_cuidado add column if not exists verificado boolean not null default false;
alter table public.tip_cuidado add column if not exists verificado_por uuid references auth.users (id) on delete set null;
alter table public.tip_cuidado add column if not exists verificado_en timestamptz;

-- ---------- huella del contenido ----------
-- Hash del texto que se está revisando. El panel la envía al verificar ("verifica esta versión
-- exacta"): si alguien editó el contenido mientras se leía, la huella ya no coincide, no se
-- actualiza ninguna fila y no se puede verificar un texto que no se alcanzó a leer.

alter table public.guia_cuidado add column if not exists huella text
  generated always as (
    md5(id_categoria::text || '|' || titulo || '|' || coalesce(contenido, '') || '|' || coalesce(tipo, ''))
  ) stored;

alter table public.tip_cuidado add column if not exists huella text
  generated always as (
    md5(id_categoria::text || '|' || titulo || '|' || coalesce(descripcion, '') || '|' || coalesce(tipo, ''))
  ) stored;

-- ---------- trigger que hace cumplir las reglas ----------

create or replace function public.control_verificacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  quien uuid := (select auth.uid());
  correo text;
  campos_verificacion text[] := array['verificado', 'verificado_por', 'verificado_en', 'huella'];
  cambio_contenido boolean;
  accion text;
begin
  if tg_op = 'INSERT' then
    new.verificado := false;
    new.verificado_por := null;
    new.verificado_en := null;
    return new;
  end if;

  select p.email into correo from public.perfiles p where p.id = quien;

  cambio_contenido := (to_jsonb(new) - campos_verificacion) is distinct from (to_jsonb(old) - campos_verificacion);

  if cambio_contenido then
    -- Editar el contenido siempre deja el registro sin verificar, sin importar lo que envíe el cliente.
    new.verificado := false;
    new.verificado_por := null;
    new.verificado_en := null;
    if old.verificado then
      accion := 'invalidar';
    end if;
  elsif new.verificado is distinct from old.verificado then
    -- Solo un verificador (o el SQL Editor / service_role, que no tienen auth.uid()) puede cambiarlo.
    if quien is not null and not public.es_verificador() then
      raise exception 'Solo una cuenta verificadora puede cambiar el estado de verificación'
        using errcode = '42501';
    end if;
    if new.verificado then
      new.verificado_por := quien;
      new.verificado_en := now();
      accion := 'verificar';
    else
      new.verificado_por := null;
      new.verificado_en := null;
      accion := 'quitar_verificacion';
    end if;
  else
    -- El estado no cambió: quién/cuándo no se pueden tocar por separado.
    new.verificado_por := old.verificado_por;
    new.verificado_en := old.verificado_en;
  end if;

  if accion is not null then
    insert into public.auditoria_admin (admin_id, admin_email, accion, objeto_tipo, objeto_id, detalle)
    values (quien, correo, accion, tg_table_name, old.id::text, new.titulo);
  end if;

  return new;
end;
$$;

revoke all on function public.control_verificacion() from public, anon, authenticated;

drop trigger if exists control_verificacion_guia on public.guia_cuidado;
create trigger control_verificacion_guia
  before insert or update on public.guia_cuidado
  for each row execute function public.control_verificacion();

drop trigger if exists control_verificacion_tip on public.tip_cuidado;
create trigger control_verificacion_tip
  before insert or update on public.tip_cuidado
  for each row execute function public.control_verificacion();

-- ---------- cómo marcar a la profesional como verificadora ----------
-- Debe tener cuenta y ser admin. Ejecutar en el SQL Editor (cambiando el correo):
--
--   update public.perfiles set rol = 'admin', verificador = true
--   where email = 'correo-de-la-profesional@ejemplo.com';
