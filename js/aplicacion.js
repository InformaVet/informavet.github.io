// js/aplicacion.js
// Filtros de guías y tips — con raza, categoría, tipo de cuidado y búsqueda por texto.
// Depende de cliente-supabase.js (cargado antes en el HTML).

const formFiltros     = document.getElementById('form-filtros')
const selTipo         = document.getElementById('filtro-tipo')
const selRaza         = document.getElementById('filtro-raza')
const selCategoria    = document.getElementById('filtro-categoria')
const selTipoCuidado  = document.getElementById('filtro-tipo-cuidado')
const inpTexto        = document.getElementById('filtro-texto')
const btnLimpiar      = document.getElementById('btn-limpiar')
const estado          = document.getElementById('estado-resultados')
const contGuias       = document.getElementById('resultados-guias')
const contTips        = document.getElementById('resultados-tips')

let razasCache      = []
let categoriasCache = []
let numeroBusqueda  = 0

// ---------------------------------------------------------------
// Badge de color por tipo de contenido
// ---------------------------------------------------------------
const TIPO_CONFIG = {
    nutricion:  { label: 'Nutrición',   color: '#16a34a', bg: '#f0fdf4' },
    salud:      { label: 'Salud',       color: '#2563eb', bg: '#eff6ff' },
    dental:     { label: 'Dental',      color: '#d97706', bg: '#fffbeb' },
    ejercicio:  { label: 'Ejercicio',   color: '#7c3aed', bg: '#f5f3ff' },
    vacunacion: { label: 'Vacunación',  color: '#0891b2', bg: '#ecfeff' },
    emergencia: { label: 'Emergencia',  color: '#dc2626', bg: '#fef2f2' },
    prevencion: { label: 'Prevención',  color: '#059669', bg: '#ecfdf5' },
    higiene:    { label: 'Higiene',     color: '#4f46e5', bg: '#eef2ff' },
    conducta:   { label: 'Conducta',    color: '#db2777', bg: '#fdf4ff' },
    bienestar:  { label: 'Bienestar',   color: '#ea580c', bg: '#fff7ed' },
}

function crearBadge(tipo) {
    const key = (tipo || '').toLowerCase()
    const cfg = TIPO_CONFIG[key] || { label: tipo || 'General', color: '#6b7280', bg: '#f3f4f6' }
    const badge = document.createElement('span')
    badge.className = 'badge-tipo'
    badge.textContent = cfg.label
    badge.style.cssText = `background:${cfg.bg};color:${cfg.color};border:1px solid ${cfg.color}30`
    return badge
}

// ---------------------------------------------------------------
// Llenar un <select>
// ---------------------------------------------------------------
function llenarSelect(select, items, campoId, campoNombre, textoTodos) {
    select.replaceChildren()
    const opTodos = document.createElement('option')
    opTodos.value = ''
    opTodos.textContent = textoTodos
    select.appendChild(opTodos)
    items.forEach(function (item) {
        const op = document.createElement('option')
        op.value = item[campoId]
        op.textContent = item[campoNombre]
        select.appendChild(op)
    })
}

// ---------------------------------------------------------------
// Tarjeta horizontal expandible
// ---------------------------------------------------------------
function crearTarjeta(item, campoCuerpo) {
    const detalle = document.createElement('details')
    detalle.className = 'tarjeta-info'

    const resumen = document.createElement('summary')

    // Badge izquierda
    resumen.appendChild(crearBadge(item.tipo))

    // Título (toma el espacio disponible)
    const titulo = document.createElement('span')
    titulo.className = 'tarjeta-titulo'
    titulo.textContent = item.titulo
    resumen.appendChild(titulo)

    // Meta derecha
    const meta = document.createElement('span')
    meta.className = 'tarjeta-meta'
    const animal    = item.categoria && item.categoria.tipo_animal ? item.categoria.tipo_animal.ta_nombre : ''
    const categoria = item.categoria ? item.categoria.ca_nombre : ''
    meta.textContent = [animal, categoria].filter(Boolean).join(' · ')
    resumen.appendChild(meta)

    // Chevron
    const chevron = document.createElement('span')
    chevron.className = 'chevron'
    chevron.setAttribute('aria-hidden', 'true')
    chevron.textContent = '▾'
    resumen.appendChild(chevron)

    detalle.appendChild(resumen)

    // Cuerpo expandible
    const cuerpo = document.createElement('div')
    cuerpo.className = 'tarjeta-cuerpo'
    cuerpo.textContent = item[campoCuerpo] || ''
    detalle.appendChild(cuerpo)

    return detalle
}

function pintar(contenedor, items, campoCuerpo) {
    contenedor.replaceChildren()
    items.forEach(function (item) {
        contenedor.appendChild(crearTarjeta(item, campoCuerpo))
    })
    contenedor.parentElement.hidden = items.length === 0
}

function mostrarError(error) {
    console.error('Error al consultar Supabase:', error)
    estado.textContent = 'No se pudo cargar la información. Intenta de nuevo más tarde.'
}

function textoConteo(guias, tips) {
    if (guias === 0 && tips === 0) return 'No se encontraron resultados con esos filtros.'
    const g = guias + (guias === 1 ? ' guía' : ' guías')
    const t = tips  + (tips  === 1 ? ' tip'  : ' tips')
    return g + ' y ' + t + ' encontrados.'
}

// Obtiene el idTipo activo: si hay raza usa su tipo, si no usa el selector de animal
function obtenerIdTipo() {
    const idRaza = selRaza.value ? Number(selRaza.value) : null
    if (idRaza) {
        const raza = razasCache.find(function (r) { return r.id_raza === idRaza })
        return raza ? raza.id_tipo : null
    }
    return selTipo.value ? Number(selTipo.value) : null
}

// ---------------------------------------------------------------
// Buscar
// ---------------------------------------------------------------
async function buscar() {
    const miBusqueda = ++numeroBusqueda
    const filtros = {
        idTipo:      obtenerIdTipo(),
        idCategoria: selCategoria.value ? Number(selCategoria.value) : null,
        tipoCuidado: selTipoCuidado.value,
        texto:       inpTexto.value
    }
    estado.textContent = 'Buscando…'
    try {
        const [guias, tips] = await Promise.all([
            buscarGuias(filtros),
            buscarTips(filtros)
        ])
        if (miBusqueda !== numeroBusqueda) return
        pintar(contGuias, guias, 'contenido')
        pintar(contTips,  tips,  'descripcion')
        estado.textContent = textoConteo(guias.length, tips.length)
    } catch (error) {
        if (miBusqueda === numeroBusqueda) mostrarError(error)
    }
}

// Al cambiar animal: filtra razas y categorías localmente
function alCambiarTipo() {
    const idTipo = selTipo.value ? Number(selTipo.value) : null
    selRaza.value      = ''
    selCategoria.value = ''

    const razasFiltradas = idTipo
        ? razasCache.filter(function (r) { return r.id_tipo === idTipo })
        : razasCache
    llenarSelect(selRaza, razasFiltradas, 'id_raza', 'r_nombre', 'Todas las razas')

    const catFiltradas = idTipo
        ? categoriasCache.filter(function (c) { return c.id_tipo === idTipo })
        : categoriasCache
    llenarSelect(selCategoria, catFiltradas, 'id_categoria', 'ca_nombre', 'Todas las categorías')

    buscar()
}

// Al cambiar raza: actualiza categorías según el tipo de esa raza
function alCambiarRaza() {
    const idRaza = selRaza.value ? Number(selRaza.value) : null
    selCategoria.value = ''

    let idTipo = selTipo.value ? Number(selTipo.value) : null
    if (idRaza) {
        const raza = razasCache.find(function (r) { return r.id_raza === idRaza })
        if (raza) idTipo = raza.id_tipo
    }

    const catFiltradas = idTipo
        ? categoriasCache.filter(function (c) { return c.id_tipo === idTipo })
        : categoriasCache
    llenarSelect(selCategoria, catFiltradas, 'id_categoria', 'ca_nombre', 'Todas las categorías')

    buscar()
}

async function limpiar() {
    selTipo.value         = ''
    selRaza.value         = ''
    selCategoria.value    = ''
    selTipoCuidado.value  = ''
    inpTexto.value        = ''
    llenarSelect(selRaza,      razasCache,      'id_raza',      'r_nombre',  'Todas las razas')
    llenarSelect(selCategoria, categoriasCache, 'id_categoria', 'ca_nombre', 'Todas las categorías')
    buscar()
}

// ---------------------------------------------------------------
// Inicio
// ---------------------------------------------------------------
async function iniciar() {
    estado.textContent = 'Cargando…'
    try {
        const resultados = await Promise.all([
            cargarTiposAnimal(),
            cargarRazas(null),
            cargarCategorias(null)
        ])
        razasCache      = resultados[1]
        categoriasCache = resultados[2]
        llenarSelect(selTipo,      resultados[0],   'id_tipo',      'ta_nombre', 'Todos los animales')
        llenarSelect(selRaza,      razasCache,      'id_raza',      'r_nombre',  'Todas las razas')
        llenarSelect(selCategoria, categoriasCache, 'id_categoria', 'ca_nombre', 'Todas las categorías')
    } catch (error) {
        mostrarError(error)
        return
    }

    selTipo.addEventListener('change', alCambiarTipo)
    selRaza.addEventListener('change', alCambiarRaza)
    selCategoria.addEventListener('change', buscar)
    selTipoCuidado.addEventListener('change', buscar)
    btnLimpiar.addEventListener('click', limpiar)
    formFiltros.addEventListener('submit', function (evento) {
        evento.preventDefault()
        buscar()
    })

    estado.textContent = 'Selecciona un animal o escribe algo para buscar.'
}

document.addEventListener('DOMContentLoaded', iniciar)