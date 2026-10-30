const { createClient } = supabase

const SUPABASE_URL = 'https://pzhbrqtulwysgdusqfbz.supabase.co'
const SUPABASE_KEY = 'sb_publishable_s7aEXosDYQp8WxjtVN3pXg_S2Jd6DMs'  // está en Settings > API

const db = createClient(SUPABASE_URL, SUPABASE_KEY)

// ---------------------------------------------------------------
// CATALOGOS (para llenar los filtros)
// ---------------------------------------------------------------

// Tipos de animal: perro, gato, etc.
async function cargarTiposAnimal() {
    const { data, error } = await db
        .from('tipo_animal')
        .select('id_tipo, ta_nombre')
        .order('ta_nombre')

    if (error) throw error
    return data
}

// Razas. Si se entrega idTipo, solo devuelve las de ese animal.
async function cargarRazas(idTipo) {
    let consulta = db
        .from('raza')
        .select('id_raza, r_nombre, id_tipo')
        .order('r_nombre')

    if (idTipo) consulta = consulta.eq('id_tipo', idTipo)

    const { data, error } = await consulta
    if (error) throw error
    return data
}

// Categorías. Si se entrega idTipo, solo devuelve las de ese animal.
async function cargarCategorias(idTipo) {
    let consulta = db
        .from('categoria')
        .select('id_categoria, ca_nombre, id_tipo')
        .order('ca_nombre')

    if (idTipo) consulta = consulta.eq('id_tipo', idTipo)

    const { data, error } = await consulta
    if (error) throw error
    return data
}

// ---------------------------------------------------------------
// BUSQUEDA DE CONTENIDO
// ---------------------------------------------------------------
// filtros = { idTipo, idCategoria, tipoCuidado, texto }  (todos opcionales)
async function buscarContenido(tabla, campoTexto, filtros) {
    const idTipo      = filtros.idTipo
    const idCategoria = filtros.idCategoria
    const tipoCuidado = filtros.tipoCuidado
    // se quitan los caracteres que rompen la sintaxis del filtro .or()
    const texto = (filtros.texto || '').replace(/[%,()*]/g, ' ').trim()

    let consulta = db
        .from(tabla)
        .select('*, categoria!inner(id_categoria, ca_nombre, id_tipo, tipo_animal(ta_nombre))')
        .order('tipo')
        .order('titulo')

    if (idCategoria) {
        // filtro exacto por categoría (Adulto Pequeño, Adulto Grande, etc.)
        consulta = consulta.eq('id_categoria', idCategoria)
    } else if (idTipo) {
        // sin categoría: filtra solo por tipo de animal
        consulta = consulta.eq('categoria.id_tipo', idTipo)
    }
    if (tipoCuidado) consulta = consulta.eq('tipo', tipoCuidado)
    if (texto)       consulta = consulta.or(`titulo.ilike.%${texto}%,${campoTexto}.ilike.%${texto}%`)

    const { data, error } = await consulta
    if (error) throw error
    return data
}

function buscarGuias(filtros) {
    return buscarContenido('guia_cuidado', 'contenido', filtros)
}

function buscarTips(filtros) {
    return buscarContenido('tip_cuidado', 'descripcion', filtros)
}