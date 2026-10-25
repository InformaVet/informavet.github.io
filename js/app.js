// js/app.js
// Filtros de guias y tips de cuidado.
// Usa las funciones de supabase.js, que debe cargarse antes en el HTML.

const formFiltros = document.getElementById('form-filtros')
const selTipo = document.getElementById('filtro-tipo')
const selCategoria = document.getElementById('filtro-categoria')
const inpTexto = document.getElementById('filtro-texto')
const btnLimpiar = document.getElementById('btn-limpiar')
const estado = document.getElementById('estado-resultados')
const contGuias = document.getElementById('resultados-guias')
const contTips = document.getElementById('resultados-tips')

// Sirve para ignorar respuestas viejas si el usuario cambia rapido de filtro
let numeroBusqueda = 0

// ---------------------------------------------------------------
// Llenar los <select>
// ---------------------------------------------------------------
function llenarSelect(select, items, campoId, campoNombre, textoTodos) {
    select.replaceChildren()

    const opcionTodos = document.createElement('option')
    opcionTodos.value = ''
    opcionTodos.textContent = textoTodos
    select.appendChild(opcionTodos)

    items.forEach(function (item) {
        const opcion = document.createElement('option')
        opcion.value = item[campoId]
        opcion.textContent = item[campoNombre]
        select.appendChild(opcion)
    })
}

// ---------------------------------------------------------------
// Pintar resultados
// textContent evita que texto de la base se interprete como HTML
// ---------------------------------------------------------------
function crearTarjeta(item, campoCuerpo) {
    const tarjeta = document.createElement('details')
    tarjeta.className = 'tarjeta-info'

    const resumen = document.createElement('summary')

    const titulo = document.createElement('span')
    titulo.className = 'tarjeta-titulo'
    titulo.textContent = item.titulo
    resumen.appendChild(titulo)

    const meta = document.createElement('span')
    meta.className = 'tarjeta-meta'
    const animal = item.categoria && item.categoria.tipo_animal
        ? item.categoria.tipo_animal.ta_nombre
        : ''
    const categoria = item.categoria ? item.categoria.ca_nombre : ''
    meta.textContent = [animal, categoria].filter(Boolean).join(' · ')
    resumen.appendChild(meta)

    tarjeta.appendChild(resumen)

    const cuerpo = document.createElement('p')
    cuerpo.className = 'tarjeta-cuerpo'
    cuerpo.textContent = item[campoCuerpo] || ''
    tarjeta.appendChild(cuerpo)

    return tarjeta
}

function pintar(contenedor, items, campoCuerpo) {
    contenedor.replaceChildren()
    items.forEach(function (item) {
        contenedor.appendChild(crearTarjeta(item, campoCuerpo))
    })
    // oculta el bloque completo (titulo incluido) si no hay nada
    contenedor.parentElement.hidden = items.length === 0
}

function mostrarError(error) {
    console.error('Error al consultar Supabase:', error)
    estado.textContent = 'No se pudo cargar la información. Intenta de nuevo más tarde.'
}

function textoConteo(guias, tips) {
    if (guias === 0 && tips === 0) {
        return 'No se encontraron resultados con esos filtros.'
    }
    const g = guias + (guias === 1 ? ' guía' : ' guías')
    const t = tips + (tips === 1 ? ' tip' : ' tips')
    return g + ' y ' + t + ' encontrados.'
}

// ---------------------------------------------------------------
// Buscar con los filtros elegidos
// ---------------------------------------------------------------
async function buscar() {
    const miBusqueda = ++numeroBusqueda

    const filtros = {
        idTipo: selTipo.value,
        idCategoria: selCategoria.value,
        texto: inpTexto.value
    }

    estado.textContent = 'Buscando...'

    try {
        const [guias, tips] = await Promise.all([
            buscarGuias(filtros),
            buscarTips(filtros)
        ])

        if (miBusqueda !== numeroBusqueda) return

        pintar(contGuias, guias, 'contenido')
        pintar(contTips, tips, 'descripcion')
        estado.textContent = textoConteo(guias.length, tips.length)
    } catch (error) {
        if (miBusqueda === numeroBusqueda) mostrarError(error)
    }
}

// Al cambiar el animal, la lista de categorias se reduce a las de ese animal
async function alCambiarTipo() {
    try {
        const categorias = await cargarCategorias(selTipo.value)
        llenarSelect(selCategoria, categorias, 'id_categoria', 'ca_nombre', 'Todas las categorías')
    } catch (error) {
        mostrarError(error)
        return
    }
    buscar()
}

async function limpiar() {
    selTipo.value = ''
    inpTexto.value = ''
    try {
        const categorias = await cargarCategorias()
        llenarSelect(selCategoria, categorias, 'id_categoria', 'ca_nombre', 'Todas las categorías')
    } catch (error) {
        mostrarError(error)
        return
    }
    buscar()
}

// ---------------------------------------------------------------
// Inicio
// ---------------------------------------------------------------
async function iniciar() {
    try {
        const [tipos, categorias] = await Promise.all([
            cargarTiposAnimal(),
            cargarCategorias()
        ])
        llenarSelect(selTipo, tipos, 'id_tipo', 'ta_nombre', 'Todos los animales')
        llenarSelect(selCategoria, categorias, 'id_categoria', 'ca_nombre', 'Todas las categorías')
    } catch (error) {
        mostrarError(error)
        return
    }

    selTipo.addEventListener('change', alCambiarTipo)
    selCategoria.addEventListener('change', buscar)
    btnLimpiar.addEventListener('click', limpiar)
    formFiltros.addEventListener('submit', function (evento) {
        evento.preventDefault()
        buscar()
    })

    buscar()
}

document.addEventListener('DOMContentLoaded', iniciar)
