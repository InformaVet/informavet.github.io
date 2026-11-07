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
