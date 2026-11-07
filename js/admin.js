// ============================================================
// admin.js — Panel de administración de InformaVet
// Solo para cuentas con rol "admin". Aquí se oculta la pantalla a quien no lo es, pero la
// seguridad real está en la base de datos (RLS) y en la Edge Function `admin-usuarios`.
// Depende de cliente-supabase.js, funciones.js y autenticacion.js.
// ============================================================

const TIPOS_CONTENIDO = {
    nutricion: "Nutrición",
    salud: "Salud",
    dental: "Dental",
    ejercicio: "Ejercicio",
    vacunacion: "Vacunación",
    emergencia: "Emergencia",
    prevencion: "Prevención",
    higiene: "Higiene",
    conducta: "Conducta",
    bienestar: "Bienestar"
}

const CONTENIDOS = {
    guias: {
        tabla: "guia_cuidado",
        campoCuerpo: "contenido",
        etiquetaCuerpo: "Contenido",
        singular: "guía",
        nueva: "Nueva guía",
        contenedor: "vista-guias"
    },
    tips: {
        tabla: "tip_cuidado",
        campoCuerpo: "descripcion",
        etiquetaCuerpo: "Descripción",
        singular: "tip",
        nueva: "Nuevo tip",
        contenedor: "vista-tips"
    }
}

const VISTAS = ["guias", "tips", "usuarios", "actividad"]

let usuarioActual = null
let categorias = []
let nombresTipoAnimal = {}
let usuarios = []
let edicion = null
const vistasCargadas = {}

const dialogo = document.getElementById("dialogo-contenido")
const formContenido = document.getElementById("form-contenido")
const avisoGlobal = document.getElementById("aviso")

// ── Utilidades ───────────────────────────────────────────────

/** Crea un elemento DOM. Los textos se insertan como texto (nunca como HTML). */
function el(etiqueta, atributos, ...hijos) {
    const nodo = document.createElement(etiqueta)
    Object.entries(atributos || {}).forEach(function ([clave, valor]) {
        if (clave === "texto") nodo.textContent = valor
        else if (clave === "clase") nodo.className = valor
        else if (clave.startsWith("on")) nodo.addEventListener(clave.slice(2), valor)
        else nodo.setAttribute(clave, valor)
    })
    hijos.flat().forEach(function (hijo) { nodo.append(hijo) })
    return nodo
}

function mostrarAviso(texto, tipo) {
    avisoGlobal.textContent = texto || ""
    avisoGlobal.className = "aviso" + (tipo ? " " + tipo : "")
}

function normalizar(texto) {
    return (texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
}

function etiquetaCategoria(idCategoria) {
    const categoria = categorias.find(function (c) { return c.id_categoria === idCategoria })
    if (!categoria) return "Sin categoría"
    return (nombresTipoAnimal[categoria.id_tipo] || "") + " · " + categoria.ca_nombre
}

function enmascararRut(rut) {
    if (!rut) return "—"
    return "••••" + rut.slice(-6)
}

function formatearFecha(iso) {
    return new Date(iso).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })
}

function celdaVacia(columnas, texto) {
    return el("tr", {}, el("td", { colspan: String(columnas), clase: "sin-resultados", texto: texto }))
}

function mensajeDeErrorAdmin(error) {
    switch (error.codigo) {
        case "no_autenticado": return "Tu sesión expiró. Inicia sesión de nuevo."
        case "sin_permiso": return "Tu cuenta no tiene permisos de administrador."
        case "objetivo_es_admin": return "No se puede actuar sobre otra cuenta de administrador."
        case "no_sobre_ti_mismo": return "No puedes hacer esto sobre tu propia cuenta."
        case "usuario_no_encontrado": return "Ese usuario ya no existe."
        case "red": return "No pudimos conectar con el servidor. Revisa tu conexión."
        default: return "No se pudo completar la acción. Intenta de nuevo."
    }
}

// ── Guías y tips ─────────────────────────────────────────────

function montarVistaContenido(clave) {
    const cfg = CONTENIDOS[clave]
    const contenedor = document.getElementById(cfg.contenedor)

    const busqueda = el("input", { type: "search", placeholder: "Buscar por título…", "aria-label": "Buscar por título" })
    const filtro = el("select", { "aria-label": "Filtrar por categoría" }, el("option", { value: "", texto: "Todas las categorías" }))
    categorias.forEach(function (c) {
        filtro.append(el("option", { value: String(c.id_categoria), texto: etiquetaCategoria(c.id_categoria) }))
    })
    const nuevo = el("button", { type: "button", clase: "btn-principal", texto: cfg.nueva, onclick: function () { abrirDialogo(clave, null) } })
    const conteo = el("p", { clase: "conteo", "aria-live": "polite" })
    const tabla = el("div", { clase: "tabla-contenedor" })

    busqueda.addEventListener("input", function () { pintarContenido(clave) })
    filtro.addEventListener("change", function () { pintarContenido(clave) })

    contenedor.replaceChildren(el("div", { clase: "herramientas" }, busqueda, filtro, nuevo), conteo, tabla)
    cfg.ui = { busqueda, filtro, conteo, tabla }
    cfg.filas = []
}

async function cargarContenido(clave) {
    const cfg = CONTENIDOS[clave]
    cfg.ui.conteo.textContent = "Cargando…"

    const { data, error } = await db.from(cfg.tabla).select("*").order("titulo")
    if (error) {
        console.error(error)
        cfg.ui.conteo.textContent = ""
        mostrarAviso("No se pudieron cargar las " + cfg.singular + "s.", "error")
        return
    }
    cfg.filas = data
    vistasCargadas[clave] = true
    pintarContenido(clave)
}

function pintarContenido(clave) {
    const cfg = CONTENIDOS[clave]
    const texto = normalizar(cfg.ui.busqueda.value)
    const idCategoria = cfg.ui.filtro.value ? Number(cfg.ui.filtro.value) : null

    const filas = cfg.filas.filter(function (fila) {
        if (idCategoria && fila.id_categoria !== idCategoria) return false
        return !texto || normalizar(fila.titulo).includes(texto)
    })

    cfg.ui.conteo.textContent = filas.length + " de " + cfg.filas.length + " " + cfg.singular + "s"

    const cuerpo = el("tbody")
    if (filas.length === 0) {
        cuerpo.append(celdaVacia(4, "No hay resultados."))
    }
    filas.forEach(function (fila) {
        cuerpo.append(el("tr", {},
            el("td", { texto: fila.titulo }),
            el("td", { texto: etiquetaCategoria(fila.id_categoria) }),
            el("td", { texto: TIPOS_CONTENIDO[fila.tipo] || fila.tipo || "—" }),
            el("td", { clase: "acciones" },
                el("button", { type: "button", clase: "btn-tabla", texto: "Editar", onclick: function () { abrirDialogo(clave, fila) } }),
                el("button", { type: "button", clase: "btn-peligro", texto: "Eliminar", onclick: function () { eliminarContenido(clave, fila) } })
            )
        ))
    })

    cfg.ui.tabla.replaceChildren(el("table", {},
        el("thead", {}, el("tr", {},
            el("th", { texto: "Título" }),
            el("th", { texto: "Animal · categoría" }),
            el("th", { texto: "Tipo" }),
            el("th", { texto: "Acciones" })
        )),
        cuerpo
    ))
}

function abrirDialogo(clave, fila) {
    const cfg = CONTENIDOS[clave]
    edicion = { clave: clave, fila: fila }

    document.getElementById("titulo-dialogo").textContent = fila ? "Editar " + cfg.singular : cfg.nueva
    document.getElementById("etiqueta-cuerpo").textContent = cfg.etiquetaCuerpo
    document.getElementById("mensaje-dialogo").textContent = ""

    const selCategoria = document.getElementById("c-categoria")
    selCategoria.replaceChildren(el("option", { value: "", texto: "Selecciona…" }))
    categorias.forEach(function (c) {
        selCategoria.append(el("option", { value: String(c.id_categoria), texto: etiquetaCategoria(c.id_categoria) }))
    })

    const selTipo = document.getElementById("c-tipo")
    selTipo.replaceChildren(el("option", { value: "", texto: "Selecciona…" }))
    const tipos = Object.assign({}, TIPOS_CONTENIDO)
    if (fila && fila.tipo && !tipos[fila.tipo]) tipos[fila.tipo] = fila.tipo
    Object.entries(tipos).forEach(function ([valor, etiqueta]) {
        selTipo.append(el("option", { value: valor, texto: etiqueta }))
    })

    document.getElementById("c-titulo").value = fila ? fila.titulo : ""
    selCategoria.value = fila ? String(fila.id_categoria) : ""
    selTipo.value = fila ? fila.tipo : ""
    document.getElementById("c-cuerpo").value = fila ? fila[cfg.campoCuerpo] : ""

    dialogo.showModal()
    document.getElementById("c-titulo").focus()
}

document.getElementById("btn-cancelar-dialogo").addEventListener("click", function () {
    dialogo.close()
})

formContenido.addEventListener("submit", async function (evento) {
    evento.preventDefault()
    if (!edicion) return

    const cfg = CONTENIDOS[edicion.clave]
    const mensaje = document.getElementById("mensaje-dialogo")
    const boton = document.getElementById("btn-guardar-dialogo")

    const datos = {
        titulo: document.getElementById("c-titulo").value.trim(),
        id_categoria: Number(document.getElementById("c-categoria").value),
        tipo: document.getElementById("c-tipo").value
    }
    datos[cfg.campoCuerpo] = document.getElementById("c-cuerpo").value.trim()

    if (!datos.titulo || !datos[cfg.campoCuerpo] || !datos.id_categoria || !datos.tipo) {
        mensaje.className = "aviso error"
        mensaje.textContent = "Completa todos los campos."
        return
    }

    boton.disabled = true
    mensaje.className = "aviso"
    mensaje.textContent = "Guardando…"

    // .select() devuelve las filas afectadas: si la base de datos no dejó escribir (RLS), llega vacío
    const consulta = edicion.fila
        ? db.from(cfg.tabla).update(datos).eq("id", edicion.fila.id).select("id")
        : db.from(cfg.tabla).insert(datos).select("id")
    const { data, error } = await consulta

    boton.disabled = false

    if (error || !data || data.length === 0) {
        console.error(error)
        mensaje.className = "aviso error"
        mensaje.textContent = error && error.code === "23502"
            ? "La tabla no genera el id automáticamente. Revisa su configuración en Supabase."
            : "No se pudo guardar. Verifica que tu cuenta tenga permisos de administrador."
        return
    }

    const claveGuardada = edicion.clave
    const eraNueva = !edicion.fila
    dialogo.close()
    mostrarAviso(eraNueva ? "Se creó la " + cfg.singular + "." : "Cambios guardados.", "exito")
    await cargarContenido(claveGuardada)
})

async function eliminarContenido(clave, fila) {
    const cfg = CONTENIDOS[clave]
    if (!confirm("¿Eliminar la " + cfg.singular + " \"" + fila.titulo + "\"? Esta acción no se puede deshacer.")) return

    const { data, error } = await db.from(cfg.tabla).delete().eq("id", fila.id).select("id")

    if (error || !data || data.length === 0) {
        console.error(error)
        mostrarAviso("No se pudo eliminar. Verifica que tu cuenta tenga permisos de administrador.", "error")
        return
    }
    mostrarAviso("Se eliminó la " + cfg.singular + ".", "exito")
    await cargarContenido(clave)
}

// ── Usuarios ─────────────────────────────────────────────────

function montarVistaUsuarios() {
    const contenedor = document.getElementById("vista-usuarios")
    const busqueda = el("input", { type: "search", placeholder: "Buscar por nombre o correo…", "aria-label": "Buscar usuarios", id: "busqueda-usuarios" })
    busqueda.addEventListener("input", pintarUsuarios)

    contenedor.replaceChildren(
        el("div", { clase: "herramientas" }, busqueda),
        el("p", { clase: "conteo", id: "conteo-usuarios", "aria-live": "polite" }),
        el("div", { clase: "tabla-contenedor", id: "tabla-usuarios" })
    )
}

async function cargarUsuarios() {
    document.getElementById("conteo-usuarios").textContent = "Cargando…"

    const { data, error } = await db
        .from("perfiles")
        .select("id, nombre, rut, email, rol, activo")
        .order("nombre")

    if (error) {
        console.error(error)
        document.getElementById("conteo-usuarios").textContent = ""
        mostrarAviso("No se pudieron cargar los usuarios.", "error")
        return
    }
    usuarios = data
    vistasCargadas.usuarios = true
    pintarUsuarios()
}

function pintarUsuarios() {
    const texto = normalizar(document.getElementById("busqueda-usuarios").value)
    const filas = usuarios.filter(function (u) {
        return !texto || normalizar(u.nombre).includes(texto) || normalizar(u.email).includes(texto)
    })

    document.getElementById("conteo-usuarios").textContent = filas.length + " de " + usuarios.length + " usuarios"

    const cuerpo = el("tbody")
    if (filas.length === 0) cuerpo.append(celdaVacia(6, "No hay resultados."))

    filas.forEach(function (u) {
        const esYo = u.id === usuarioActual.id
        const esAdminFila = u.rol === "admin"
        const inactivo = u.activo === false

        const acciones = el("td", { clase: "acciones" })
        if (esYo) {
            acciones.append("Tu cuenta")
        } else if (esAdminFila) {
            acciones.append("Administrador")
        } else {
            acciones.append(
                el("button", {
                    type: "button",
                    clase: "btn-tabla",
                    texto: inactivo ? "Reactivar" : "Desactivar",
                    onclick: function () { accionUsuario(u, inactivo ? "reactivar" : "desactivar") }
                }),
                el("button", { type: "button", clase: "btn-peligro", texto: "Eliminar", onclick: function () { accionUsuario(u, "eliminar") } })
            )
        }

        cuerpo.append(el("tr", {},
            el("td", { texto: u.nombre || "—" }),
            el("td", { texto: u.email || "—" }),
            el("td", { texto: enmascararRut(u.rut) }),
            el("td", {}, el("span", { clase: "etiqueta-estado " + (esAdminFila ? "admin" : "activo"), texto: esAdminFila ? "Administrador" : "Usuario" })),
            el("td", {}, el("span", { clase: "etiqueta-estado " + (inactivo ? "inactivo" : "activo"), texto: inactivo ? "Desactivada" : "Activa" })),
            acciones
        ))
    })

    document.getElementById("tabla-usuarios").replaceChildren(el("table", {},
        el("thead", {}, el("tr", {},
            el("th", { texto: "Nombre" }),
            el("th", { texto: "Correo" }),
            el("th", { texto: "RUT" }),
            el("th", { texto: "Rol" }),
            el("th", { texto: "Estado" }),
            el("th", { texto: "Acciones" })
        )),
        cuerpo
    ))
}

async function accionUsuario(usuario, accion) {
    if (accion === "desactivar" &&
        !confirm("¿Desactivar la cuenta de " + usuario.email + "? No podrá iniciar sesión hasta que la reactives.")) return

    if (accion === "eliminar") {
        const respuesta = prompt(
            "Vas a ELIMINAR la cuenta de " + usuario.email + " junto con sus mascotas, historial y fotos. " +
            "Esto no se puede deshacer.\n\nEscribe ELIMINAR para confirmar:"
        )
        if (respuesta !== "ELIMINAR") return
    }

    document.querySelectorAll("#tabla-usuarios button").forEach(function (b) { b.disabled = true })
    mostrarAviso("Procesando…")

    const { error } = await invocarFuncion("admin-usuarios", { accion: accion, usuario_id: usuario.id })

    if (error) {
        console.error(error)
        mostrarAviso(mensajeDeErrorAdmin(error), "error")
        pintarUsuarios()
        return
    }

    const textos = { desactivar: "Cuenta desactivada.", reactivar: "Cuenta reactivada.", eliminar: "Cuenta eliminada." }
    mostrarAviso(textos[accion], "exito")
    await cargarUsuarios()
}

// ── Actividad (auditoría) ────────────────────────────────────

function montarVistaActividad() {
    document.getElementById("vista-actividad").replaceChildren(
        el("p", { clase: "conteo", id: "conteo-actividad", "aria-live": "polite" }),
        el("div", { clase: "tabla-contenedor", id: "tabla-actividad" })
    )
}

async function cargarActividad() {
    const conteo = document.getElementById("conteo-actividad")
    conteo.textContent = "Cargando…"

    const { data, error } = await db
        .from("auditoria_admin")
        .select("*")
        .order("creado_en", { ascending: false })
        .limit(50)

    if (error) {
        console.error(error)
        conteo.textContent = ""
        mostrarAviso("No se pudo cargar la actividad.", "error")
        return
    }

    const verbos = { desactivar: "Desactivó", reactivar: "Reactivó", eliminar: "Eliminó" }
    conteo.textContent = "Últimas " + data.length + " acciones de administración"

    const cuerpo = el("tbody")
    if (data.length === 0) cuerpo.append(celdaVacia(4, "Todavía no hay actividad registrada."))
    data.forEach(function (registro) {
        cuerpo.append(el("tr", {},
            el("td", { texto: formatearFecha(registro.creado_en) }),
            el("td", { texto: registro.admin_email || "—" }),
            el("td", { texto: verbos[registro.accion] || registro.accion }),
            el("td", { texto: registro.objetivo_email || "—" })
        ))
    })

    document.getElementById("tabla-actividad").replaceChildren(el("table", {},
        el("thead", {}, el("tr", {},
            el("th", { texto: "Fecha" }),
            el("th", { texto: "Administrador" }),
            el("th", { texto: "Acción" }),
            el("th", { texto: "Cuenta afectada" })
        )),
        cuerpo
    ))
}

// ── Pestañas ─────────────────────────────────────────────────

function activarVista(nombre) {
    VISTAS.forEach(function (vista) {
        const activa = vista === nombre
        const pestana = document.getElementById("pestana-" + vista)
        pestana.setAttribute("aria-selected", String(activa))
        pestana.tabIndex = activa ? 0 : -1
        document.getElementById("vista-" + vista).hidden = !activa
    })

    mostrarAviso("")

    if (nombre === "actividad") cargarActividad()
    else if (!vistasCargadas[nombre]) {
        if (nombre === "usuarios") cargarUsuarios()
        else cargarContenido(nombre)
    }
}

document.querySelectorAll(".pestanas button").forEach(function (pestana) {
    pestana.addEventListener("click", function () { activarVista(pestana.dataset.vista) })

    pestana.addEventListener("keydown", function (evento) {
        const delta = { ArrowRight: 1, ArrowLeft: -1 }[evento.key]
        if (!delta) return
        const siguiente = VISTAS[(VISTAS.indexOf(pestana.dataset.vista) + delta + VISTAS.length) % VISTAS.length]
        activarVista(siguiente)
        document.getElementById("pestana-" + siguiente).focus()
    })
})

// ── Inicio ───────────────────────────────────────────────────

async function iniciar() {
    usuarioActual = await requiereAuth()
    if (!usuarioActual) return

    const perfil = await obtenerPerfil()
    document.getElementById("estado-carga").hidden = true

    if (!perfil || perfil.rol !== "admin" || perfil.activo === false) {
        document.getElementById("acceso-denegado").hidden = false
        return
    }

    document.getElementById("panel").hidden = false

    try {
        const [tipos, cats] = await Promise.all([cargarTiposAnimal(), cargarCategorias(null)])
        categorias = cats
        tipos.forEach(function (t) { nombresTipoAnimal[t.id_tipo] = t.ta_nombre })
    } catch (error) {
        console.error(error)
        mostrarAviso("No se pudieron cargar las categorías.", "error")
    }

    montarVistaContenido("guias")
    montarVistaContenido("tips")
    montarVistaUsuarios()
    montarVistaActividad()
    activarVista("guias")
}

iniciar()
