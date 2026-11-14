-- Animales exóticos: tipo, categorías, razas y contenido base (borrador para revisión).
--
-- Qué agrega:
--   1. tipo_animal  : "Exótico" (para lo que no es perro, gato, ave ni reptil: conejo, cobayo, etc.)
--   2. categoria    : 4 grupos según la dieta, porque de eso depende casi todo el cuidado.
--   3. raza         : 7 especies de partida.
--   4. peso_saludable, guia_cuidado, alimento, tip_cuidado: contenido inicial por categoría.
--   5. sync_desde_sheets: se le enseña la hoja "EXOTICO" (antes la ignoraba).
--
-- Es idempotente: se puede ejecutar más de una vez sin duplicar nada. Los ids de tipo,
-- categoría y raza se calculan (max + 1) porque esas tablas no los generan solas.
--
-- IMPORTANTE: el texto es un borrador y debe revisarlo la veterinaria. Las guías y tips
-- nuevos nacen como "No verificado" (lo fuerza el trigger de verificación) y así se muestran
-- en la web hasta que ella los revise desde el panel de administración.

-- ---------- seguridad de las secuencias ----------
-- Si alguien cargó filas con id manual, la secuencia puede ir atrasada y chocar al insertar.

do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('tipo_animal', 'id_tipo'), ('guia_cuidado', 'id'), ('tip_cuidado', 'id'),
      ('alimento', 'id'), ('peso_saludable', 'id')
    ) as t(tabla, columna)
  loop
    if pg_get_serial_sequence('public.' || r.tabla, r.columna) is not null then
      execute format(
        'select setval(pg_get_serial_sequence(%L, %L), greatest((select coalesce(max(%I), 1) from public.%I), 1))',
        'public.' || r.tabla, r.columna, r.columna, r.tabla
      );
    end if;
  end loop;
end $$;

-- ---------- 1. tipo de animal ----------

insert into public.tipo_animal (id_tipo, ta_nombre)
select (select coalesce(max(id_tipo), 0) + 1 from public.tipo_animal), 'Exótico'
where not exists (select 1 from public.tipo_animal where ta_nombre ilike 'Ex_tico');

-- ---------- 2. categorías (por dieta) ----------

insert into public.categoria (id_categoria, ca_nombre, id_tipo)
select
  (select coalesce(max(id_categoria), 0) from public.categoria) + row_number() over (order by v.orden),
  v.nombre,
  t.id_tipo
from (values
  (1, 'Exótico Herbívoro'),
  (2, 'Exótico Omnívoro'),
  (3, 'Exótico Insectívoro'),
  (4, 'Exótico Carnívoro')
) as v(orden, nombre)
cross join (select id_tipo from public.tipo_animal where ta_nombre ilike 'Ex_tico' limit 1) t
where not exists (select 1 from public.categoria c where c.ca_nombre = v.nombre);

-- ---------- 3. razas / especies ----------

insert into public.raza (id_raza, r_nombre, id_tipo)
select
  (select coalesce(max(id_raza), 0) from public.raza) + row_number() over (order by v.orden),
  v.nombre,
  t.id_tipo
from (values
  (1, 'Conejo doméstico'),
  (2, 'Cobayo'),
  (3, 'Chinchilla'),
  (4, 'Hámster sirio'),
  (5, 'Rata doméstica'),
  (6, 'Erizo de tierra africano'),
  (7, 'Hurón')
) as v(orden, nombre)
cross join (select id_tipo from public.tipo_animal where ta_nombre ilike 'Ex_tico' limit 1) t
where not exists (
  select 1 from public.raza r where r.r_nombre = v.nombre and r.id_tipo = t.id_tipo
);

-- ---------- 4a. peso saludable (orientativo) ----------

insert into public.peso_saludable (id_categoria, edad_min_meses, edad_max_meses, peso_min_kg, peso_max_kg, notas)
select c.id_categoria, v.edad_min, v.edad_max, v.peso_min, v.peso_max, v.notas
from (values
  ('Exótico Herbívoro', 6, 999, 0.4, 5.0,
   'Rangos orientativos de adulto: chinchilla 0.4-0.6 kg, cobayo 0.7-1.2 kg, conejo enano 1-2 kg, conejo mediano 2-5 kg. Pesar cada semana: perder peso es una señal de alerta temprana.'),
  ('Exótico Omnívoro', 3, 999, 0.1, 0.6,
   'Rangos orientativos de adulto: hámster sirio 0.1-0.15 kg (100-150 g), rata doméstica 0.25-0.6 kg (los machos pesan más). Pesar cada semana con una balanza de cocina.'),
  ('Exótico Insectívoro', 6, 999, 0.3, 0.6,
   'Erizo de tierra africano adulto: 0.3-0.6 kg. La obesidad es frecuente: controlar la porción y que haga ejercicio. Pesar cada 2 semanas.'),
  ('Exótico Carnívoro', 6, 999, 0.6, 2.0,
   'Hurón adulto: las hembras suelen pesar 0.6-1.2 kg y los machos 1-2 kg. El peso varía con la estación (suben en otoño). Pesar cada mes.')
) as v(cat, edad_min, edad_max, peso_min, peso_max, notas)
join public.categoria c on c.ca_nombre = v.cat
where not exists (
  select 1 from public.peso_saludable p where p.id_categoria = c.id_categoria and p.notas = v.notas
);

-- ---------- 4b. guías de cuidado ----------

insert into public.guia_cuidado (id_categoria, titulo, contenido, tipo)
select c.id_categoria, v.titulo, v.contenido, v.tipo
from (values
  ('Exótico Herbívoro', 'Nutrición para conejos, cobayos y chinchillas',
   'El heno de pasto debe estar disponible todo el día y es la base de la dieta (en conejos y chinchillas, más del 80%): mantiene la digestión en movimiento y desgasta los dientes, que crecen toda la vida. Complementar con verduras de hoja verde frescas y una porción pequeña de pellets formulados para la especie. El cobayo no produce vitamina C: necesita una fuente diaria (por ejemplo pimentón rojo o perejil, o el suplemento que indique el veterinario). La fruta y la zanahoria son solo un premio, por su azúcar. Agua fresca siempre.',
   'nutricion'),
  ('Exótico Herbívoro', 'Hábitat y salud de herbívoros pequeños',
   'Necesitan espacio para moverse (la jaula sola no alcanza) y compañía de su misma especie: el conejo y el cobayo son sociales. La chinchilla se baña con polvo especial 2 o 3 veces por semana (nunca con agua) y necesita un ambiente fresco y seco: por sobre 25 °C hay riesgo de golpe de calor. Revisar dientes y uñas con regularidad. Un conejo o cobayo que deja de comer por 12 horas o más es una urgencia veterinaria.',
   'salud'),
  ('Exótico Omnívoro', 'Nutrición para hámsteres y ratas',
   'La base es un alimento formulado para la especie (bloques o mezcla balanceada), con pequeñas porciones de verdura fresca. Proteína ocasional (huevo cocido, insectos) en cantidades mínimas. Los hámsteres guardan comida en las mejillas y en su nido: retirar los alimentos frescos que se echen a perder. Evitar el exceso de semillas grasas (maní, girasol) y los dulces. Agua fresca en bebedero de bola.',
   'nutricion'),
  ('Exótico Omnívoro', 'Hábitat y salud de roedores pequeños',
   'Necesitan una rueda de ejercicio del tamaño adecuado y de superficie sólida, material para roer y escondites. El hámster sirio vive solo; las ratas son sociales y necesitan compañía. Usar sustrato sin polvo y evitar virutas aromáticas de cedro o pino sin tratar, porque irritan las vías respiratorias. Señales de alerta: estornudos o secreción nasal, pelo erizado, diarrea, bultos nuevos o dejar de comer.',
   'salud'),
  ('Exótico Insectívoro', 'Nutrición para erizos de tierra',
   'Son insectívoros: la base es un alimento seco alto en proteína y bajo en grasa formulado para erizos (consulta a tu veterinario si usar una alternativa), más insectos como grillos y gusanos de harina, estos últimos con moderación por su grasa. Son intolerantes a la lactosa: nada de leche. Controlar la porción, porque la obesidad es frecuente. Agua fresca en un bebedero accesible.',
   'nutricion'),
  ('Exótico Insectívoro', 'Temperatura y salud del erizo',
   'Necesita un ambiente estable entre 24 y 27 °C: con menos de 20 °C puede entrar en un estado parecido a la hibernación, que es peligroso. Usar una fuente de calor segura y un termómetro. Es nocturno: darle rueda de ejercicio de superficie sólida y un escondite. Señales de alerta: pérdida de púas fuera de la muda, letargo, no comer, temblores o descoordinación al caminar.',
   'salud'),
  ('Exótico Carnívoro', 'Nutrición para hurones',
   'Son carnívoros estrictos: necesitan una dieta alta en proteína y grasa de origen animal y muy baja en carbohidratos, con alimento formulado para hurones. No digieren bien la fibra, el azúcar ni los lácteos. Su digestión es muy rápida, por lo que comen varias veces al día. Agua fresca siempre.',
   'nutricion'),
  ('Exótico Carnívoro', 'Salud preventiva del hurón',
   'Duermen muchas horas, pero necesitan varias horas fuera de la jaula en un espacio seguro (se cuelan por huecos muy pequeños). Consultar al veterinario por las vacunas (moquillo y rabia), la desparasitación y el control de pulgas. Son sensibles al calor: evitar ambientes sobre 25 °C. Las enfermedades de las glándulas suprarrenales y del páncreas son comunes en hurones adultos: hacer revisiones veterinarias periódicas desde los 3 años.',
   'salud')
) as v(cat, titulo, contenido, tipo)
join public.categoria c on c.ca_nombre = v.cat
where not exists (
  select 1 from public.guia_cuidado g where g.id_categoria = c.id_categoria and g.titulo = v.titulo
);

-- ---------- 4c. alimentos ----------

insert into public.alimento (id_categoria, nombre, es_recomendado, frecuencia, descripcion)
select c.id_categoria, v.nombre, v.recomendado, v.frecuencia, v.descripcion
from (values
  ('Exótico Herbívoro', 'Heno de pasto', true, 'Todo el día',
   'Base de la dieta. Mantiene la digestión en movimiento y desgasta los dientes, que no dejan de crecer.'),
  ('Exótico Herbívoro', 'Pimentón rojo', true, 'Diario (cobayos)',
   'Buena fuente de vitamina C, que el cobayo no puede producir. Ofrecer en trozos pequeños.'),
  ('Exótico Herbívoro', 'Zanahoria y fruta', true, 'Ocasional (premio)',
   'Tienen mucho azúcar. En porciones pequeñas y de vez en cuando.'),
  ('Exótico Herbívoro', 'Chocolate', false, 'Nunca',
   'TÓXICO. Contiene teobromina y cafeína, que estos animales no pueden metabolizar.'),
  ('Exótico Herbívoro', 'Cebolla, ajo y puerro', false, 'Nunca',
   'TÓXICO. Dañan los glóbulos rojos y pueden causar anemia.'),
  ('Exótico Herbívoro', 'Aguacate (palta)', false, 'Nunca',
   'TÓXICO para conejos y otros herbívoros pequeños.'),
  ('Exótico Herbívoro', 'Lechuga iceberg', false, 'Evitar',
   'Aporta casi solo agua y puede causar diarrea. Preferir verduras de hoja verde oscura.'),
  ('Exótico Omnívoro', 'Alimento formulado para la especie', true, 'Base de la dieta',
   'Bloques o mezcla balanceada para hámsteres o ratas. Cubre los requerimientos que las semillas solas no cubren.'),
  ('Exótico Omnívoro', 'Brócoli y zanahoria', true, 'Ocasional',
   'En trozos pequeños y frescos. Retirar lo que sobre para que no se pudra en el nido.'),
  ('Exótico Omnívoro', 'Huevo cocido', true, 'Ocasional (porción mínima)',
   'Fuente de proteína. Sin sal ni condimentos.'),
  ('Exótico Omnívoro', 'Chocolate', false, 'Nunca',
   'TÓXICO. Puede causar problemas cardíacos y neurológicos.'),
  ('Exótico Omnívoro', 'Cebolla y ajo', false, 'Nunca',
   'TÓXICO. Dañan los glóbulos rojos.'),
  ('Exótico Omnívoro', 'Dulces y alimentos con azúcar', false, 'Evitar',
   'Favorecen la obesidad y la diabetes, sobre todo en hámsteres.'),
  ('Exótico Insectívoro', 'Alimento formulado para erizos', true, 'Base de la dieta',
   'Alto en proteína y bajo en grasa. Es la base nutricional más completa.'),
  ('Exótico Insectívoro', 'Grillos y gusanos de harina', true, 'Varias veces por semana, en porciones pequeñas',
   'Fuente natural de proteína. Los gusanos de harina son grasos: darlos con moderación.'),
  ('Exótico Insectívoro', 'Leche y lácteos', false, 'Nunca',
   'Los erizos son intolerantes a la lactosa: causa diarrea y deshidratación.'),
  ('Exótico Insectívoro', 'Uvas y pasas', false, 'Evitar',
   'Pueden ser tóxicas. No vale la pena el riesgo.'),
  ('Exótico Insectívoro', 'Frutos secos y semillas', false, 'Evitar',
   'Son muy grasos y pueden atorarse en la boca.'),
  ('Exótico Carnívoro', 'Alimento formulado para hurones', true, 'Base de la dieta',
   'Alto en proteína y grasa animal. Es lo que su organismo necesita.'),
  ('Exótico Carnívoro', 'Carne cocida sin condimentos', true, 'Ocasional (premio)',
   'Pollo o pavo, sin sal, sin piel y sin huesos.'),
  ('Exótico Carnívoro', 'Fruta y dulces', false, 'Evitar',
   'No digieren bien el azúcar y puede causar problemas de páncreas.'),
  ('Exótico Carnívoro', 'Leche y lácteos', false, 'Evitar',
   'No digieren la lactosa: causa diarrea.'),
  ('Exótico Carnívoro', 'Chocolate y cafeína', false, 'Nunca',
   'TÓXICO.'),
  ('Exótico Carnívoro', 'Alimento para perros', false, 'Evitar',
   'No tiene la proteína y la grasa que necesita un carnívoro estricto.')
) as v(cat, nombre, recomendado, frecuencia, descripcion)
join public.categoria c on c.ca_nombre = v.cat
where not exists (
  select 1 from public.alimento a where a.id_categoria = c.id_categoria and a.nombre = v.nombre
);

-- ---------- 4d. tips ----------

insert into public.tip_cuidado (id_categoria, titulo, descripcion, tipo)
select c.id_categoria, v.titulo, v.descripcion, v.tipo
from (values
  ('Exótico Herbívoro', 'Señal de urgencia: dejó de comer',
   'Un conejo o cobayo que no come ni hace deposiciones por 12 horas o más necesita atención veterinaria inmediata: su digestión no puede detenerse.',
   'emergencia'),
  ('Exótico Omnívoro', 'Higiene semanal',
   'Retirar a diario la comida fresca que sobre y cambiar el sustrato y limpiar la jaula una vez por semana. Un ambiente sucio favorece los problemas respiratorios.',
   'higiene'),
  ('Exótico Insectívoro', 'Antes de adquirirlo',
   'Confirma con el SAG si la especie puede tenerse como mascota en Chile y que provenga de un criadero autorizado, nunca de captura silvestre. Ubica antes a un veterinario que atienda animales exóticos.',
   'prevencion'),
  ('Exótico Carnívoro', 'Casa a prueba de hurones',
   'Tapar huecos, cables y espacios bajo los muebles: se cuelan por aperturas muy pequeñas. Antes de adquirir uno, confirma con el SAG que la especie pueda tenerse como mascota y ubica a un veterinario que atienda animales exóticos.',
   'bienestar')
) as v(cat, titulo, descripcion, tipo)
join public.categoria c on c.ca_nombre = v.cat
where not exists (
  select 1 from public.tip_cuidado t where t.id_categoria = c.id_categoria and t.titulo = v.titulo
);

-- ---------- 5. sync_desde_sheets: reconocer la hoja EXOTICO ----------
-- En vez de reemplazar la función completa (podría tener cambios más nuevos que esta migración),
-- se lee su definición actual y se le agregan solo dos cosas:
--   * la hoja EXOTICO (o EXÓTICO) apunta al tipo "Exótico";
--   * para esa hoja, la categoría se busca como "Exótico <etapa_de_vida>" (con tilde), de modo
--     que en la planilla etapa_de_vida debe ser Herbívoro, Omnívoro, Insectívoro o Carnívoro.
-- Si la función ya conoce EXOTICO, o su texto cambió y no se reconoce, no hace nada y avisa.

do $$
declare
  definicion text;
  nueva text;
begin
  if to_regprocedure('public.sync_desde_sheets(jsonb)') is null then
    raise notice 'sync_desde_sheets no existe: se omite el ajuste de la función';
    return;
  end if;

  definicion := pg_get_functiondef('public.sync_desde_sheets(jsonb)'::regprocedure);

  if definicion like '%EXOTICO%' then
    raise notice 'sync_desde_sheets ya conoce la hoja EXOTICO';
    return;
  end if;

  nueva := replace(
    definicion,
    $q$ELSIF v_datos->>'hoja' = 'REPTIL' THEN v_id_tipo := 4;$q$,
    $q$ELSIF v_datos->>'hoja' = 'REPTIL' THEN v_id_tipo := 4;
    ELSIF v_datos->>'hoja' IN ('EXOTICO', 'EXÓTICO') THEN v_id_tipo := (SELECT id_tipo FROM tipo_animal WHERE ta_nombre ILIKE 'Ex_tico' LIMIT 1);$q$
  );
  nueva := replace(
    nueva,
    $q$v_nombre_categoria := initcap(v_datos->>'hoja');$q$,
    $q$v_nombre_categoria := CASE WHEN v_datos->>'hoja' IN ('EXOTICO', 'EXÓTICO') THEN 'Exótico' ELSE initcap(v_datos->>'hoja') END;$q$
  );

  if nueva like '%EXOTICO%' and nueva like '%CASE WHEN v_datos->>''hoja'' IN%' then
    execute nueva;
    raise notice 'sync_desde_sheets ahora reconoce la hoja EXOTICO';
  else
    raise notice 'No se reconoció el texto de sync_desde_sheets: agregar la hoja EXOTICO a mano';
  end if;
end $$;
