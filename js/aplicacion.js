// js/aplicacion.js
// Filtros de guías y tips — con raza, categoría, tipo de cuidado y búsqueda por texto.
// Depende de cliente-supabase.js (cargado antes en el HTML).

const formFiltros     = document.getElementById('form-filtros')
const selTipo         = document.getElementById('filtro-tipo')
const selRaza         = document.getElementById('filtro-raza')
const selCategoria    = document.getElementById('filtro-categoria')
const selTipoCuidado  = document.getElementById('filtro-tipo-cuidado')
const selVerificacion = document.getElementById('filtro-verificacion')
const inpTexto        = document.getElementById('filtro-texto')
const btnLimpiar      = document.getElementById('btn-limpiar')
const estado          = document.getElementById('estado-resultados')
const contGrupos =
    document.getElementById("grupos-cuidados");
const cargaResultados =
    document.getElementById("carga-resultados");

const sinResultados =
    document.getElementById("sin-resultados");

const navegacionResultados =
    document.getElementById("navegacion-resultados");

let vistaActual = "todos";
let guiasEncontradas = [];
let tipsEncontrados = [];
let totalTips = 0;
let razasCache      = []
let categoriasCache = []
let numeroBusqueda  = 0
let tipoFijoId = null;

const filtrosActivos =
    document.getElementById("filtros-activos");

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

const DESCRIPCIONES_CUIDADO = {

    nutricion:
        "Alimentación equilibrada y necesidades nutricionales.",

    salud:
        "Cuidados generales y controles veterinarios.",

    dental:
        "Higiene bucal y prevención de problemas dentales.",

    ejercicio:
        "Actividad física y estimulación diaria.",

    vacunacion:
        "Protección frente a enfermedades mediante vacunas.",

    prevencion:
        "Prevención de enfermedades y cuidado responsable.",

    higiene:
        "Limpieza y mantenimiento de tu mascota.",

    conducta:
        "Comprende el comportamiento de tu mascota.",

    bienestar:
        "Mejora la calidad de vida de tu compañero.",

    emergencia:
        "Identifica situaciones que requieren atención veterinaria."

};

function crearBadge(tipo) {
    const key = (tipo || '').toLowerCase()
    const cfg = TIPO_CONFIG[key] || { label: tipo || 'General', color: '#6b7280', bg: '#f3f4f6' }
    const badge = document.createElement('span')
    badge.className = 'badge-tipo'
    badge.textContent = cfg.label
    badge.style.cssText = `background:${cfg.bg};color:${cfg.color};border:1px solid ${cfg.color}30`
    return badge
}

// Iconos según el tipo de cuidado

const ICONOS_CUIDADO = {
    nutricion: "M3 2v7a3 3 0 0 0 6 0V2 M6 2v20 M18 2c-3 3-4 7-4 10h5 M19 2v20",

    salud: "M22 12h-4l-3 7-6-14-3 7H2",

    dental: "M12 5c-4-5-10-2-9 4 1 4 3 12 6 12 2 0 1-7 3-7s1 7 3 7c3 0 5-8 6-12 1-6-5-9-9-4Z",

    ejercicio: "M3 9v6 M7 5v14 M17 5v14 M21 9v6 M7 12h10",

    vacunacion: "M18 2l4 4 M17 7l4-4 M4 20l-2 2 M3 17l4 4 12-12-4-4Z M9 11l4 4",

    prevencion: "M12 22s8-4 8-12V5l-8-3-8 3v5c0 8 8 12 8 12Z M9 12l2 2 4-4",

    higiene: "M12 2C8 8 5 11 5 15a7 7 0 0 0 14 0c0-4-3-7-7-13Z",

    conducta: "M21 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 0 1 19 0Z M7 11h10",

    bienestar: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",

    emergencia: "M12 2L2 21h20Z M12 9v5 M12 17v.1"
};

function crearIconoCuidado(tipo) {

    const key = (tipo || "").toLowerCase();

    const config = TIPO_CONFIG[key] || {
        color: "#92400e",
        bg: "#ffebad"
    };

    const icono = document.createElement("span");

    icono.className = "tarjeta-icono";
    icono.style.color = config.color;
    icono.style.backgroundColor = config.bg;

    const svg = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
    );

    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");

    const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
    );

    path.setAttribute(
        "d",
        Object.hasOwn(ICONOS_CUIDADO, key)
            ? ICONOS_CUIDADO[key]
            : "M12 6v12 M6 12h12"
    );

    svg.appendChild(path);
    icono.appendChild(svg);

    return icono;
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

    const detalle = document.createElement("details");
    detalle.className = "tarjeta-info";

    const resumen = document.createElement("summary");

    // Icono del cuidado

    resumen.appendChild(crearIconoCuidado(item.tipo));

    // Información principal

    const informacion = document.createElement("div");
    informacion.className = "tarjeta-informacion";

    const titulo = document.createElement("span");
    titulo.className = "tarjeta-titulo";
    titulo.textContent = item.titulo;

    informacion.appendChild(titulo);

    // Animal y categoría

    const meta = document.createElement("span");
    meta.className = "tarjeta-meta";

    const animal =
        item.categoria?.tipo_animal?.ta_nombre || "";

    const categoria =
        item.categoria?.ca_nombre || "";

    meta.textContent = [animal, categoria]
        .filter(Boolean)
        .join(" · ");

    informacion.appendChild(meta);

    // Etiquetas

    const indicadores = document.createElement("div");
    indicadores.className = "tarjeta-indicadores";

    indicadores.appendChild(crearBadge(item.tipo));

    // Verificación veterinaria

    if (item.verificado === true) {

        const sello = document.createElement("span");
        sello.className = "sello-verificado";
        sello.textContent = "✓ Verificado";

        indicadores.appendChild(sello);
    }

    informacion.appendChild(indicadores);
    resumen.appendChild(informacion);

    // Flecha desplegable

    const chevron = document.createElement("span");
    chevron.className = "chevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = "▾";

    resumen.appendChild(chevron);
    detalle.appendChild(resumen);

    // Contenido desplegable

    const cuerpo = document.createElement("div");
    cuerpo.className = "tarjeta-cuerpo";

    cuerpo.textContent = item[campoCuerpo] || "";

    detalle.appendChild(cuerpo);

    // Información de verificación

    if (item.verificado !== undefined) {

        const pie = document.createElement("p");

        pie.className = "tarjeta-verificacion" +
            (item.verificado ? " es-verificado" : "");

        if (item.verificado) {

            const fecha = item.verificado_en
                ? " el " + new Date(item.verificado_en)
                    .toLocaleDateString("es-CL", {
                        dateStyle: "long"
                    })
                : "";

            pie.textContent =
                "✓ Verificado por la veterinaria de InformaVet" +
                fecha + ".";

        } else {

            pie.textContent =
                "Pendiente de revisión por la veterinaria. " +
                "Úsalo como orientación general y consulta a tu veterinario.";

        }

        detalle.appendChild(pie);
    }

    return detalle;
}

// CREAR UNA CATEGORÍA DESPLEGABLE

function crearGrupoCuidado(tipo, guias, tips) {

    const config = Object.hasOwn(TIPO_CONFIG, tipo)
        ? TIPO_CONFIG[tipo]
        : {
            label: "General",
            color: "#92400e",
            bg: "#ffebad"
        };

    const grupo = document.createElement("details");

    grupo.className = "grupo-cuidado";

    grupo.style.setProperty(
        "--grupo-color", config.color
    );

    grupo.style.setProperty(
        "--grupo-fondo", config.bg
    );

    // Encabezado

    const resumen = document.createElement("summary");

    resumen.appendChild(crearIconoCuidado(tipo));

    const informacion = document.createElement("div");
    informacion.className = "grupo-informacion";

    const titulo = document.createElement("span");
    titulo.className = "grupo-titulo";
    titulo.textContent = config.label;

    const descripcion = document.createElement("p");
    descripcion.className = "grupo-descripcion";

    descripcion.textContent =
        DESCRIPCIONES_CUIDADO[tipo] ||
        "Información general para el cuidado de tu mascota.";

    informacion.appendChild(titulo);
    informacion.appendChild(descripcion);

    resumen.appendChild(informacion);

    const flecha = document.createElement("span");
    flecha.className = "grupo-flecha";
    flecha.textContent = "▾";
    flecha.setAttribute("aria-hidden", "true");

    resumen.appendChild(flecha);

    grupo.appendChild(resumen);

    // Contenido de la categoría

    const contenido = document.createElement("div");
    contenido.className = "grupo-contenido";

    // Guías

    if (guias.length > 0) {

        const tituloGuias = document.createElement("h3");

        tituloGuias.innerHTML = `
            <svg viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true">

                <path d="M12 7v14"/>
                <path d="M3 4h4a5 5 0 0 1 5 5
                        5 5 0 0 1 5-5h4v15h-4
                        a5 5 0 0 0-5 2
                        5 5 0 0 0-5-2H3Z"/>

            </svg>

            <span>Guías de cuidado</span>
        `;

        contenido.appendChild(tituloGuias);

        guias.forEach(guia => {

            contenido.appendChild(
                crearTarjeta(guia, "contenido")
            );

        });
    }

    // Consejos

    if (tips.length > 0) {

        const tituloTips = document.createElement("h3");

        tituloTips.innerHTML = `
            <svg viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true">

                <path d="M9 18h6"/>
                <path d="M10 22h4"/>
                <path d="M9 15c0-2-3-3-3-7
                        a6 6 0 0 1 12 0
                        c0 4-3 5-3 7"/>

            </svg>

            <span>Consejos de cuidado</span>
        `;

        contenido.appendChild(tituloTips);

        tips.forEach(tip => {

            contenido.appendChild(
                crearTarjeta(tip, "descripcion")
            );

        });
    }

    grupo.appendChild(contenido);

    return grupo;
}


// AGRUPAR TODOS LOS RESULTADOS

function pintarGrupos(guias, tips) {

    contGrupos.replaceChildren();

    const grupos = new Map();

    function agregarItem(item, coleccion) {

        const tipo = (item.tipo || "general")
            .toLowerCase()
            .trim();

        if (!grupos.has(tipo)) {

            grupos.set(tipo, {
                guias: [],
                tips: []
            });

        }

        grupos.get(tipo)[coleccion].push(item);
    }

    guias.forEach(guia => {
        agregarItem(guia, "guias");
    });

    tips.forEach(tip => {
        agregarItem(tip, "tips");
    });

    grupos.forEach((contenido, tipo) => {

        contGrupos.appendChild(
            crearGrupoCuidado(
                tipo,
                contenido.guias,
                contenido.tips
            )
        );

    });

    contGrupos.hidden = grupos.size === 0;
}

function mostrarError(error) {

    console.error("Error al consultar Supabase:", error);

    estado.textContent =
        "No se pudo cargar la información. Intenta nuevamente.";

    cargaResultados.hidden = true;
    sinResultados.hidden = true;
    navegacionResultados.hidden = true;

    contGrupos.hidden = true;
}

function textoConteo(guias, tips) {
    if (guias === 0 && tips === 0) return 'No se encontraron resultados con esos filtros.'
    const g = guias + (guias === 1 ? ' guía' : ' guías')
    const t = tips  + (tips  === 1 ? ' tip'  : ' tips')
    return g + ' y ' + t + ' encontrados.'
}

// Obtiene el idTipo activo: si hay raza usa su tipo, si no usa el selector de animal
function obtenerIdTipo() {

    // Mantener el animal elegido desde la página principal
    if (tipoFijoId !== null) {
        return tipoFijoId;
    }

    const idRaza = selRaza.value
        ? Number(selRaza.value)
        : null;

    if (idRaza) {
        const raza = razasCache.find(function(r) {
            return r.id_raza === idRaza;
        });

        return raza ? raza.id_tipo : null;
    }

    return selTipo.value
        ? Number(selTipo.value)
        : null;
}

function actualizarFiltrosActivos() {

    filtrosActivos.replaceChildren();

    const campos = [
        { campo: selTipo, nombre: "Animal" },
        { campo: selRaza, nombre: "Raza" },
        { campo: selCategoria, nombre: "Categoría" },
        { campo: selTipoCuidado, nombre: "Cuidado" },
        { campo: selVerificacion, nombre: "Verificación" },
        { campo: inpTexto, nombre: "Búsqueda" }
    ];

    campos.forEach(({ campo, nombre }) => {

        if (!campo.value.trim()) return;

        const valor = campo.tagName === "SELECT"
            ? campo.selectedOptions[0].textContent
            : campo.value.trim();

        const fijo =
            campo === selTipo && tipoFijoId !== null;

        const etiqueta = document.createElement(
            fijo ? "span" : "button"
        );

        etiqueta.className = "filtro-activo";
        // Color según el tipo de cuidado seleccionado

        if (campo === selTipoCuidado) {

            const config = TIPO_CONFIG[campo.value];

            if (config) {

                etiqueta.style.color = config.color;
                etiqueta.style.backgroundColor = config.bg;
                etiqueta.style.borderColor = config.color + "40";

            }
        }

        etiqueta.textContent = fijo
            ? `${nombre}: ${valor}`
            : `${nombre}: ${valor} ×`;

        if (!fijo) {

            etiqueta.type = "button";

            etiqueta.setAttribute(
                "aria-label",
                `Eliminar filtro ${nombre}: ${valor}`
            );

            etiqueta.addEventListener("click", () => {

                campo.value = "";

                if (campo === inpTexto) {
                    buscar();
                } else {
                    campo.dispatchEvent(
                        new Event("change")
                    );
                }

            });
        }

        filtrosActivos.appendChild(etiqueta);
    });

    filtrosActivos.hidden =
        filtrosActivos.children.length === 0;
}
// Mostrar el indicador de carga

function mostrarCarga() {

    cargaResultados.hidden = false;
    sinResultados.hidden = true;

    navegacionResultados.hidden = true;

    contGrupos.hidden = true;
}

// Actualizar la vista seleccionada

function actualizarVista() {

    const guiasVisibles = vistaActual === "tips"
        ? []
        : guiasEncontradas;

    const tipsVisibles = vistaActual === "guias"
        ? []
        : tipsEncontrados;

    pintarGrupos(guiasVisibles, tipsVisibles);

    const hayResultados =
        guiasVisibles.length + tipsVisibles.length > 0;

    sinResultados.hidden = hayResultados;

    navegacionResultados.hidden =
        guiasEncontradas.length +
        tipsEncontrados.length === 0;

    navegacionResultados.querySelectorAll("button")
        .forEach(boton => {

            boton.setAttribute(
                "aria-pressed",
                String(boton.dataset.vista === vistaActual)
            );

        });

    estado.textContent = hayResultados
        ? "Selecciona una categoría para explorar sus cuidados."
        : "No encontramos coincidencias.";
}
// ---------------------------------------------------------------
// Buscar
// ---------------------------------------------------------------
async function buscar() {

    const miBusqueda = ++numeroBusqueda;

    actualizarFiltrosActivos();

    const filtros = {
        idTipo: obtenerIdTipo(),

        idCategoria: selCategoria.value
            ? Number(selCategoria.value)
            : null,

        tipoCuidado: selTipoCuidado.value,

        soloVerificados:
            selVerificacion.value === "si",

        texto: inpTexto.value
    };

    estado.textContent = "Buscando…";

    mostrarCarga();

    try {

        const [guias, tips] = await Promise.all([
            buscarGuias(filtros),
            buscarTips(filtros)
        ]);

        if (miBusqueda !== numeroBusqueda) return;

        guiasEncontradas = guias;
        tipsEncontrados = tips;

        cargaResultados.hidden = true;

        actualizarVista();

    } catch (error) {

        if (miBusqueda === numeroBusqueda) {
            mostrarError(error);
        }

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

    // Mantener el animal si viene desde una tarjeta
    selTipo.value = tipoFijoId !== null
        ? String(tipoFijoId)
        : "";

    selRaza.value = "";
    selCategoria.value = "";
    selTipoCuidado.value = "";
    selVerificacion.value = "";
    inpTexto.value = "";

    // Actualizar las razas y categorías del animal
    alCambiarTipo();
}

// ---------------------------------------------------------------
// Inicio
// ---------------------------------------------------------------
async function iniciar() {
    estado.textContent = 'Cargando…'

    let resultados;

    try {
        resultados = await Promise.all([
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
    selVerificacion.addEventListener('change', buscar)
    btnLimpiar.addEventListener('click', limpiar)
    formFiltros.addEventListener('submit', function (evento) {
        evento.preventDefault()
        buscar()
    })

   

    // REVISAR SI SE LLEGO DESDE UNA TARJETA DE ANIMAL

    const parametros = new URLSearchParams(window.location.search);
    const animalSeleccionado = parametros.get("animal");

    if (animalSeleccionado) {

        const tipo = resultados[0].find(function(animal) {
            return animal.ta_nombre.trim().toLowerCase() ===
                animalSeleccionado.trim().toLowerCase();
        });

        if (!tipo) {
            estado.textContent =
                "No se encontró el animal seleccionado.";
            return;
        }

        // Mantener únicamente esta especie
        tipoFijoId = Number(tipo.id_tipo);
        selTipo.value = String(tipoFijoId);

        // Ocultar el selector Animal
        selTipo.closest("label").style.display = "none";

        // Cambiar el título
        const titulo = document.querySelector(
            ".guias .encabezado-seccion h2"
        );

        const nombres = {
            Canino: "perros",
            Felino: "gatos",
            Ave: "aves",
            Reptil: "reptiles",
            "Exótico": "animales exóticos"
        };

        if (titulo) {
            titulo.textContent = "Cuidados para " +
                (nombres[tipo.ta_nombre] || tipo.ta_nombre);
        }

        // Filtrar razas y categorías, y buscar resultados
        alCambiarTipo();

    } else {

        // Acceso desde el menú general de Cuidados
        tipoFijoId = null;
        buscar();

    }


}
// Navegación entre guías y consejos

navegacionResultados.addEventListener("click", evento => {

    const boton = evento.target.closest("button[data-vista]");

    if (!boton) return;

    vistaActual = boton.dataset.vista;

    actualizarVista();
});

document.addEventListener('DOMContentLoaded', iniciar)