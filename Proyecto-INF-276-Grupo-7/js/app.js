// ============================================================
// app.js — Lógica de filtros y renderizado de resultados
// Proyecto InformaVet - Grupo 7 INF-276
// Depende de supabase.js (debe cargarse antes)
// ============================================================

// ── Elementos del DOM ──────────────────────────────────────
const selectTipo      = document.getElementById('filtro-tipo')
const selectCategoria = document.getElementById('filtro-categoria')
const inputTexto      = document.getElementById('filtro-texto')
const form            = document.getElementById('form-filtros')
const btnLimpiar      = document.getElementById('btn-limpiar')
const estado          = document.getElementById('estado-resultados')
const bloques         = document.querySelectorAll('.bloque-resultados')
const contenedorGuias = document.getElementById('resultados-guias')
const contenedorTips  = document.getElementById('resultados-tips')

// Solo ejecutar en la página de filtros (los elementos existen)
if (form) {

    // ── Inicialización ─────────────────────────────────────
    document.addEventListener('DOMContentLoaded', async () => {
        mostrarEstado('Cargando...')
        try {
            const tipos = await cargarTiposAnimal()
            tipos.forEach(t => {
                const opt = document.createElement('option')
                opt.value = t.id_tipo
                opt.textContent = t.ta_nombre
                selectTipo.appendChild(opt)
            })
            // Mostrar todo al cargar
            await ejecutarBusqueda()
        } catch (err) {
            mostrarEstado('Error al conectar con la base de datos.')
            console.error(err)
        }
    })

    // ── Cambio de tipo → actualiza categorías y busca ──────
    selectTipo.addEventListener('change', async () => {
        const idTipo = selectTipo.value || null

        // Reiniciar categorías
        selectCategoria.innerHTML = '<option value="">Todas las categorías</option>'

        if (idTipo) {
            try {
                const categorias = await cargarCategorias(idTipo)
                categorias.forEach(c => {
                    const opt = document.createElement('option')
                    opt.value = c.id_categoria
                    opt.textContent = c.ca_nombre
                    selectCategoria.appendChild(opt)
                })
            } catch (err) {
                console.error('Error cargando categorías:', err)
            }
        }

        await ejecutarBusqueda()
    })

    // ── Submit del formulario ──────────────────────────────
    form.addEventListener('submit', async e => {
        e.preventDefault()
        await ejecutarBusqueda()
    })

    // ── Limpiar filtros ────────────────────────────────────
    btnLimpiar.addEventListener('click', async () => {
        selectTipo.value = ''
        selectCategoria.innerHTML = '<option value="">Todas las categorías</option>'
        inputTexto.value = ''
        await ejecutarBusqueda()
    })

}

// ── Búsqueda principal ─────────────────────────────────────
async function ejecutarBusqueda() {
    mostrarEstado('Buscando...')
    bloques.forEach(b => b.hidden = true)
    contenedorGuias.innerHTML = ''
    contenedorTips.innerHTML  = ''

    const filtros = {
        idTipo:      selectTipo.value       || null,
        idCategoria: selectCategoria.value  || null,
        texto:       inputTexto.value.trim() || null
    }

    try {
        const [guias, tips] = await Promise.all([
            buscarGuias(filtros),
            buscarTips(filtros)
        ])

        const total = guias.length + tips.length

        if (total === 0) {
            mostrarEstado('No se encontraron resultados para esa búsqueda.')
            return
        }

        const plural = total !== 1 ? 's' : ''
        mostrarEstado(`${total} resultado${plural} encontrado${plural}.`)

        if (guias.length > 0) {
            guias.forEach(g => contenedorGuias.appendChild(crearTarjetaGuia(g)))
            bloques[0].hidden = false
        }

        if (tips.length > 0) {
            tips.forEach(t => contenedorTips.appendChild(crearTarjetaTip(t)))
            bloques[1].hidden = false
        }

    } catch (err) {
        mostrarEstado('Error al buscar. Recarga la página e intenta de nuevo.')
        console.error(err)
    }
}

// ── Tarjeta de guía de cuidado ─────────────────────────────
function crearTarjetaGuia(guia) {
    const animal    = guia.categoria?.tipo_animal?.ta_nombre || ''
    const categoria = guia.categoria?.ca_nombre              || ''
    const tipo      = guia.tipo                              || ''

    const art = document.createElement('article')
    art.className = 'tarjeta-resultado tarjeta-guia'
    art.innerHTML = `
        <div class="tarjeta-etiquetas">
            ${animal ? `<span class="etiqueta-animal">${animal}</span>`        : ''}
            ${tipo   ? `<span class="etiqueta-tipo etiqueta-${tipo}">${tipo}</span>` : ''}
        </div>
        <h4 class="tarjeta-titulo">${esc(guia.titulo)}</h4>
        <p class="tarjeta-subtitulo">${esc(categoria)}</p>
        <p class="tarjeta-texto">${esc(guia.contenido)}</p>
    `
    return art
}

// ── Tarjeta de tip de cuidado ──────────────────────────────
function crearTarjetaTip(tip) {
    const animal    = tip.categoria?.tipo_animal?.ta_nombre || ''
    const categoria = tip.categoria?.ca_nombre              || ''
    const tipo      = tip.tipo                              || ''

    const art = document.createElement('article')
    art.className = 'tarjeta-resultado tarjeta-tip'
    art.innerHTML = `
        <div class="tarjeta-etiquetas">
            ${animal ? `<span class="etiqueta-animal">${animal}</span>`        : ''}
            ${tipo   ? `<span class="etiqueta-tipo etiqueta-${tipo}">${tipo}</span>` : ''}
        </div>
        <h4 class="tarjeta-titulo">${esc(tip.titulo)}</h4>
        <p class="tarjeta-subtitulo">${esc(categoria)}</p>
        <p class="tarjeta-texto">${esc(tip.descripcion)}</p>
    `
    return art
}

// ── Helpers ────────────────────────────────────────────────
function mostrarEstado(msg) {
    if (estado) estado.textContent = msg
}

// Escapa HTML para evitar XSS al insertar texto de la BD
function esc(str) {
    if (!str) return ''
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}
