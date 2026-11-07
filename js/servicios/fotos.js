// ===============================================================
// Identificador de raza por foto
// La foto se envía a la Edge Function `identificar-mascota` de Supabase, que guarda las
// claves de Gemini / TheDogAPI / TheCatAPI como secretos (aquí no hay ninguna clave).
// Requiere sesión iniciada. Depende de cliente-supabase.js, funciones.js y autenticacion.js.
// ===============================================================

const LADO_MAXIMO_FOTO = 1024
const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"]
const MAX_BYTES_FOTO = 10 * 1024 * 1024

// Reduce la foto antes de enviarla: sube más rápido y gasta menos cuota de la IA.
function reducirFoto(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file)
        const imagen = new Image()

        imagen.onload = () => {
            try {
                const escala = Math.min(1, LADO_MAXIMO_FOTO / Math.max(imagen.width, imagen.height))
                const canvas = document.createElement("canvas")
                canvas.width = Math.max(1, Math.round(imagen.width * escala))
                canvas.height = Math.max(1, Math.round(imagen.height * escala))

                const contexto = canvas.getContext("2d")
                contexto.fillStyle = "white"
                contexto.fillRect(0, 0, canvas.width, canvas.height)
                contexto.drawImage(imagen, 0, 0, canvas.width, canvas.height)

                const dataUrl = canvas.toDataURL("image/jpeg", 0.85)
                resolve({ base64: dataUrl.split(",")[1], mimeType: "image/jpeg" })
            } catch (error) {
                reject(error)
            } finally {
                URL.revokeObjectURL(url)
            }
        }
        imagen.onerror = () => {
            URL.revokeObjectURL(url)
            reject(new Error("formato_no_compatible"))
        }
        imagen.src = url
    })
}

function mensajeDeErrorIA(error) {
    if (error.message === "formato_no_compatible") {
        return "No pudimos leer esa imagen. Prueba con una foto JPG, PNG o WebP."
    }
    switch (error.codigo) {
        case "no_autenticado":
            return "Tu sesión expiró. Inicia sesión de nuevo para usar esta herramienta."
        case "limite":
            return error.mensaje
        case "ia_no_disponible":
            return "El servicio de IA está saturado. Intenta de nuevo en unos minutos."
        case "imagen_muy_grande":
            return "La imagen es demasiado grande. Prueba con otra."
        case "solicitud_invalida":
            return "No pudimos procesar esa imagen. Prueba con otra foto (JPG, PNG o WebP)."
        case "red":
            return "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo."
        default:
            return "No se pudo identificar la mascota. Intenta de nuevo en unos segundos."
    }
}

function mostrarEstadoIA(texto, esError) {
    const indicador = document.getElementById("estadoCarga")
    if (!indicador) return
    indicador.textContent = texto
    indicador.style.color = esError ? "#b91c1c" : "#d97706"
    indicador.style.display = texto ? "block" : "none"
}

function pintarResultadoIA(resultado) {
    const contenedor = document.getElementById("resultadoIdentificacion")

    if (resultado.animal === "otro") {
        contenedor.style.display = "none"
        mostrarEstadoIA("No parece haber un perro o un gato en la foto. Prueba con otra donde se vea claramente.", true)
        return
    }

    const detalles = resultado.detalles || {}
    document.getElementById("resAnimal").textContent = resultado.animal.toUpperCase()
    document.getElementById("resRaza").textContent = resultado.raza_estimada || "No determinada"
    document.getElementById("resPatron").textContent = resultado.patron_o_subtipo || "No disponible"
    document.getElementById("resTemperamento").textContent = detalles.temperament || "No disponible"
    document.getElementById("resEsperanza").textContent = detalles.life_span || "No disponible"
    document.getElementById("resOrigen").textContent = detalles.origin || "No disponible"
    contenedor.style.display = "block"

    if (typeof resultado.restantes === "number") {
        mostrarEstadoIA("Identificaciones disponibles esta hora: " + resultado.restantes, false)
    } else {
        mostrarEstadoIA("", false)
    }
}

let identificando = false

function crearTarjetaIA(item, campoCuerpo) {
    const detalle = document.createElement("details");
    detalle.style.cssText = "background:white;border:1px solid #fce3a3;border-radius:12px;overflow:hidden;margin-bottom:10px;";

    const resumen = document.createElement("summary");
    resumen.style.cssText = "display:flex;align-items:center;gap:10px;padding:13px 16px;cursor:pointer;list-style:none;font-weight:600;color:#333;";

    const titulo = document.createElement("span");
    titulo.style.cssText = "flex:1;font-size:14px;";
    titulo.textContent = item.titulo;
    resumen.appendChild(titulo);

    if (item.tipo) {
        const badge = document.createElement("span");
        badge.style.cssText = "font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;background:#fef3c7;color:#92400e;border:1px solid #fcd34d;white-space:nowrap;";
        badge.textContent = item.tipo.charAt(0).toUpperCase() + item.tipo.slice(1);
        resumen.appendChild(badge);
    }

    detalle.appendChild(resumen);

    const cuerpo = document.createElement("div");
    cuerpo.style.cssText = "padding:14px 16px;color:#555;line-height:1.65;font-size:14px;border-top:1px solid #fce3a3;white-space:pre-line;";
    cuerpo.textContent = item[campoCuerpo] || "";
    detalle.appendChild(cuerpo);

    return detalle;
}

async function cargarCuidadosPorDeteccion(animal, razaEstimada) {
    const seccion      = document.getElementById("cuidados-detectados");
    const estadoEl     = document.getElementById("estado-cuidados-ia");
    const bloqueGuias  = document.getElementById("bloque-guias-ia");
    const bloqueTips   = document.getElementById("bloque-tips-ia");
    const listaGuias   = document.getElementById("lista-guias-ia");
    const listaTips    = document.getElementById("lista-tips-ia");

    if (!seccion || typeof cargarTiposAnimal !== "function") return;

    seccion.style.display = "block";
    estadoEl.textContent  = "Buscando cuidados para tu mascota…";

    try {
        const mapEspecie = { perro: "Perro", gato: "Gato", ave: "Ave", conejo: "Conejo" };
        const nombreEspecie = mapEspecie[animal.toLowerCase()];

        if (!nombreEspecie) {
            estadoEl.textContent = "Sin cuidados específicos para esta especie en nuestra base de datos.";
            return;
        }

        const tipos = await cargarTiposAnimal();
        const tipo  = tipos.find(function (t) {
            return t.ta_nombre.toLowerCase() === nombreEspecie.toLowerCase();
        });

        if (!tipo) {
            estadoEl.textContent = "No encontramos esta especie en nuestra base de datos todavía.";
            return;
        }

        const filtros = { idTipo: tipo.id_tipo };
        const [guias, tips] = await Promise.all([buscarGuias(filtros), buscarTips(filtros)]);

        listaGuias.replaceChildren();
        guias.forEach(function (g) { listaGuias.appendChild(crearTarjetaIA(g, "contenido")); });
        bloqueGuias.style.display = guias.length > 0 ? "block" : "none";

        listaTips.replaceChildren();
        tips.forEach(function (t) { listaTips.appendChild(crearTarjetaIA(t, "descripcion")); });
        bloqueTips.style.display = tips.length > 0 ? "block" : "none";

        const totalG = guias.length;
        const totalT = tips.length;
        if (totalG === 0 && totalT === 0) {
            estadoEl.textContent = "Aún no tenemos contenido para esta especie. ¡Pronto lo agregaremos!";
        } else {
            estadoEl.textContent =
                "Para " + nombreEspecie + (razaEstimada ? " · " + razaEstimada : "") + " — " +
                totalG + (totalG === 1 ? " guía" : " guías") + " y " +
                totalT + (totalT === 1 ? " tip" : " tips") + " disponibles.";
        }

    } catch (err) {
        console.error("Error cargando cuidados IA:", err);
        estadoEl.textContent = "No se pudieron cargar los cuidados recomendados.";
    }
}

async function procesarFotoMascota(file) {
    if (identificando) return
    identificando = true

    const contenedor = document.getElementById("resultadoIdentificacion")
    try {
        if (!TIPOS_FOTO.includes(file.type)) {
            mostrarEstadoIA("Usa una foto JPG, PNG o WebP.", true)
            return
        }
        if (file.size > MAX_BYTES_FOTO) {
            mostrarEstadoIA("La foto supera los 10 MB. Prueba con otra.", true)
            return
        }

        mostrarEstadoIA("Analizando la foto con IA...", false)
        if (contenedor) contenedor.style.display = "none"

        const { base64, mimeType } = await reducirFoto(file)
        const { data, error } = await invocarFuncion("identificar-mascota", { imagen: base64, mimeType })

        if (error) {
            mostrarEstadoIA(mensajeDeErrorIA(error), true)
            return
        }
        pintarResultadoIA(data)
        cargarCuidadosPorDeteccion(data.animal, data.raza_estimada)
    } catch (error) {
        console.error("Error al identificar la mascota:", error)
        mostrarEstadoIA(mensajeDeErrorIA(error), true)
    } finally {
        identificando = false
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const inputFoto = document.getElementById("fotoMascotaInput")
    const vistaPrevia = document.getElementById("previewFoto")
    const etiquetaSubir = document.getElementById("etiquetaSubirFoto")
    const enlaceLogin = document.getElementById("loginParaIA")

    if (!inputFoto) return

    // La herramienta usa cuota de IA: solo para personas con sesión iniciada.
    const usuario = await obtenerUsuario()
    if (!usuario) {
        if (etiquetaSubir) etiquetaSubir.hidden = true
        if (enlaceLogin) enlaceLogin.hidden = false
        return
    }

    inputFoto.addEventListener("change", (e) => {
        const file = e.target.files[0]
        if (!file) return
        if (vistaPrevia) {
            vistaPrevia.src = URL.createObjectURL(file)
            vistaPrevia.style.display = "block"
        }
        procesarFotoMascota(file).finally(() => { inputFoto.value = "" })
    })
})
