
// MIS MASCOTAS
// Los datos viven en Supabase (tabla `mascotas`) y las fotos en Storage (bucket privado
// `fotos-mascotas`). Cada persona solo ve lo suyo: lo garantiza la base de datos (RLS).
// Depende de cliente-supabase.js y autenticacion.js (cargados antes en el HTML).

const formulario = document.getElementById("form-mascota");
const lista = document.getElementById("lista-mascotas");
const mensajeVacio = document.getElementById("mensaje-vacio");

const fotoInput = document.getElementById("foto");
const vistaFoto = document.getElementById("vista-foto");
const mensaje = document.getElementById("mensaje-mascota");

const tituloFormulario = document.getElementById("titulo-formulario");
const btnGuardar = document.getElementById("btn-guardar");
const btnCancelar = document.getElementById("btn-cancelar");
const selectEspecie = document.getElementById("especie");
const selectCategoria = document.getElementById("categoria");

const BUCKET_FOTOS = "fotos-mascotas";
const LADO_MAXIMO_FOTO = 800;

const imagenesDefault = {
    "Perro": "../recursos/imagenes/3.png",
    "Gato": "../recursos/imagenes/4.png",
    "Ave": "../recursos/imagenes/5.png",
    "Animal exótico": "../recursos/imagenes/6.png",
    "Reptil": "../recursos/imagenes/7.png"
};


let usuario = null;
let mascotas = [];
let urlsFotos = {};      // ruta en Storage -> URL firmada temporal
let idEditando = null;
let fotoAnteriorPath = null;
let urlTemporal = null;

const iconos = {
    "Perro": "🐶",
    "Gato": "🐱",
    "Ave": "🐦",
    "Conejo": "🐰",
    "Animal exótico": "🐾",
    "Otro": "🐾"
};


/* CARGAR CATEGORIAS DESDE SUPABASE */

async function cargarCategoriasMascota(idSeleccionado = null) {

    selectCategoria.replaceChildren(
        new Option("Selecciona una categoría", "")
    );

    selectCategoria.disabled = true;

    if (!selectEspecie.value) return;

    try {
        // Obtener los tipos de animales registrados
        const tipos = await cargarTiposAnimal();
        console.table(tipos);
        // Buscar el tipo seleccionado

            const equivalencias = {
                "Perro": "Canino",
                "Gato": "Felino",
                "Ave": "Ave",
                "Reptil": "Reptil",
                "Animal exótico": "Exótico"
            };
            const nombreTipo = equivalencias[selectEspecie.value];

            const tipo = tipos.find(function(t) {
                return t.ta_nombre.trim().toLowerCase() ===
                    (nombreTipo || "").toLowerCase();
            });


        if (!tipo) {
            const disponibles = tipos.map(function(t) {
                return t.id_tipo + ": " + t.ta_nombre;
            }).join(" | ");

            throw new Error(
                "No se encontró '" + selectEspecie.value +
                "'. Tipos disponibles en Supabase: " +
                (disponibles || "Ninguno")
            );
        }

        // Obtener sus categorías
        const categorias = await cargarCategorias(tipo.id_tipo);

        categorias.forEach(function(categoria) {
            const opcion = new Option(
                categoria.ca_nombre,
                categoria.id_categoria
            );

            selectCategoria.add(opcion);
        });

        if (categorias.length === 0) {
            mensaje.textContent =
                "No hay categorías disponibles para este animal.";
            return;
        }

        selectCategoria.disabled = false;

        // Recuperar categoría cuando se edita una mascota
        if (idSeleccionado !== null) {
            selectCategoria.value = String(idSeleccionado);
        }

    } catch (error) {
        console.error("Error al cargar categorías:", error);

        mensaje.textContent =
            "No se pudieron cargar las categorías: " +
            error.message;
    }
}

// ACTUALIZAR CATEGORIAS CUANDO CAMBIA EL ANIMAL

selectEspecie.addEventListener("change", function() {
    cargarCategoriasMascota();
});


// CARGAR DESDE SUPABASE

async function cargarMascotas() {
    const { data, error } = await db
        .from("mascota")
        .select("*")
        .order("creado_en", { ascending: true });

    if (error) throw error;
    mascotas = data;

    // Las fotos son privadas: se muestran con URLs firmadas de 1 hora
    urlsFotos = {};
    const rutas = mascotas.map(m => m.foto_path).filter(Boolean);

    if (rutas.length > 0) {
        const { data: firmadas } = await db.storage
            .from(BUCKET_FOTOS)
            .createSignedUrls(rutas, 3600);

        (firmadas || []).forEach(function(f) {
            if (f.signedUrl) urlsFotos[f.path] = f.signedUrl;
        });
    }
}

// MOSTRAR VISTA PREVIA

function mostrarFoto(src) {
    if (src) {
        vistaFoto.src = src;
        vistaFoto.hidden = false;
    } else {
        vistaFoto.removeAttribute("src");
        vistaFoto.hidden = true;
    }
}

function limpiarUrlTemporal() {
    if (urlTemporal) {
        URL.revokeObjectURL(urlTemporal);
        urlTemporal = null;
    }
}

// SELECCIONAR FOTOGRAFIA

fotoInput.addEventListener("change", function() {
    limpiarUrlTemporal();

    const archivo = fotoInput.files[0];

    if (!archivo) {
        mostrarFoto(urlsFotos[fotoAnteriorPath] || "");
        return;
    }

    const permitidos = [
        "image/png",
        "image/jpeg",
        "image/webp"
    ];

    if (!permitidos.includes(archivo.type)) {
        mensaje.textContent = "Selecciona una imagen válida.";
        fotoInput.value = "";
        mostrarFoto(urlsFotos[fotoAnteriorPath] || "");
        return;
    }

    if (archivo.size > 5 * 1024 * 1024) {
        mensaje.textContent = "La imagen supera los 5 MB.";
        fotoInput.value = "";
        mostrarFoto(urlsFotos[fotoAnteriorPath] || "");
        return;
    }

    mensaje.textContent = "";
    urlTemporal = URL.createObjectURL(archivo);
    mostrarFoto(urlTemporal);
});

// REDUCIR LA IMAGEN ANTES DE SUBIRLA (devuelve un Blob JPEG)

function procesarImagen(archivo) {
    return new Promise(function(resolve, reject) {
        const imagen = new Image();
        const url = URL.createObjectURL(archivo);

        imagen.onload = function() {
            try {
                const escala = Math.min(
                    1,
                    LADO_MAXIMO_FOTO / Math.max(imagen.width, imagen.height)
                );

                const canvas = document.createElement("canvas");

                canvas.width = Math.max(
                    1, Math.round(imagen.width * escala)
                );

                canvas.height = Math.max(
                    1, Math.round(imagen.height * escala)
                );

                const contexto = canvas.getContext("2d");

                contexto.fillStyle = "white";
                contexto.fillRect(
                    0, 0, canvas.width, canvas.height
                );

                contexto.drawImage(
                    imagen, 0, 0,
                    canvas.width, canvas.height
                );

                canvas.toBlob(function(blob) {
                    URL.revokeObjectURL(url);

                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error("No se pudo procesar la fotografía."));
                    }
                }, "image/jpeg", 0.8);

            } catch (error) {
                URL.revokeObjectURL(url);
                reject(error);
            }
        };

        imagen.onerror = function() {
            URL.revokeObjectURL(url);
            reject(new Error("No se pudo leer la fotografía."));
        };

        imagen.src = url;
    });
}

// REINICIAR FORMULARIO

function reiniciarFormulario() {
    formulario.reset();
    selectCategoria.replaceChildren(
    new Option("Primero selecciona un tipo de animal", "")
    );
    selectCategoria.disabled = true;
    idEditando = null;
    fotoAnteriorPath = null;

    limpiarUrlTemporal();
    mostrarFoto("");

    tituloFormulario.textContent = "Registrar una mascota";
    btnGuardar.textContent = "Guardar mascota";
    btnCancelar.hidden = true;
}

//cambia texto del formulario de raza según especie seleccionada

function actualizarLabelRaza() {
    const especie = document.getElementById("especie").value;
    const label = document.getElementById("label-raza");
    const input = document.getElementById("raza");

    if (especie === "Animal exótico" || especie === "Ave") {
        label.textContent = "Especie específica";
        input.placeholder = "Ej: Hurón, Conejo, Erizo";
    } else {
        label.textContent = "Raza o variedad";
        input.placeholder = "Ej: Siamés, Mestizo";
    }
}

document.getElementById("especie")
    .addEventListener("change", actualizarLabelRaza);

// MOSTRAR PERFILES

function mostrarMascotas() {
    lista.innerHTML = "";

    mensajeVacio.textContent = "Todavía no tienes mascotas registradas.";
    mensajeVacio.hidden = mascotas.length > 0;

    mascotas.forEach(function(mascota) {
        const tarjeta = document.createElement("article");
        tarjeta.className = "tarjeta-mascota";

        const urlFoto = urlsFotos[mascota.foto_path];

        const imagenDefault =
            imagenesDefault[mascota.especie] ||
            "../recursos/imagenes/default-exotico.png";

        const imagen = document.createElement("img");

        imagen.className = "foto-mascota";
        imagen.alt = "Foto de " + mascota.m_nombre;

        // Mostrar foto del usuario o imagen predeterminada
        imagen.src = urlFoto || imagenDefault;

        // Si la fotografía falla, mostrar imagen predeterminada
        imagen.onerror = function() {
            this.onerror = null;
            this.src = imagenDefault;
        };

        const titulo = document.createElement("h3");
        titulo.textContent = mascota.m_nombre;

        const detalles = document.createElement("p");

        detalles.textContent =
            "Tipo: " + mascota.especie +
            "\n" + (mascota.especie === "Animal exótico" || mascota.especie === "Ave"? "Especie: ": "Raza: ") +(mascota.raza || "No especificada") +
            "\nEdad: " + mascota.m_edad + " años" +
            "\nPeso: " + (
                mascota.m_peso ? mascota.m_peso + " kg" : "No indicado"
            );

        // BOTON EDITAR

        const editar = document.createElement("button");
        editar.type = "button";
        editar.className = "btn-editar";
        editar.textContent = "Editar perfil";

        editar.addEventListener("click", async function() {
            idEditando = mascota.id_mascota;

            document.getElementById("nombre").value = mascota.m_nombre;
            document.getElementById("especie").value = mascota.especie;
            await cargarCategoriasMascota(mascota.id_categoria);
            document.getElementById("raza").value = mascota.raza || "";
            document.getElementById("edad").value = mascota.m_edad;
            document.getElementById("peso").value = mascota.m_peso || "";

            fotoAnteriorPath = mascota.foto_path;
            fotoInput.value = "";

            limpiarUrlTemporal();
            mostrarFoto(urlsFotos[fotoAnteriorPath] || "");

            tituloFormulario.textContent = "Editar mascota";
            btnGuardar.textContent = "Guardar cambios";
            btnCancelar.hidden = false;

            mensaje.textContent = "";

            formulario.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        });

        // BOTON ELIMINAR

        const eliminar = document.createElement("button");
        eliminar.type = "button";
        eliminar.className = "btn-eliminar";
        eliminar.textContent = "Eliminar perfil";

        eliminar.addEventListener("click", async function() {
            if (!confirm("¿Eliminar a " + mascota.m_nombre + "?")) {
                return;
            }

            eliminar.disabled = true;

            try {
                if (mascota.foto_path) {
                    await db.storage.from(BUCKET_FOTOS).remove([mascota.foto_path]);
                }

                // El historial se borra solo (ON DELETE CASCADE)
                const { error } = await db
                    .from("mascota")
                    .delete()
                    .eq("id_mascota", mascota.id_mascota);

                if (error) throw error;

                mascotas = mascotas.filter(m => m.id_mascota !== mascota.id_mascota);

                if (idEditando === mascota.id_mascota) {
                    reiniciarFormulario();
                }

                mostrarMascotas();
            } catch (error) {
                console.error(error);
                mensaje.textContent = "No se pudo eliminar el perfil.";
                eliminar.disabled = false;
            }
        });

        const acciones = document.createElement("div");
        acciones.className = "acciones-tarjeta";

        acciones.append(editar, eliminar);
        const ingresar = document.createElement("a");

        ingresar.href = "ficha_mascota.html?id=" +
            encodeURIComponent(mascota.id_mascota);

        ingresar.className = "btn-ingresar-mascota";
        ingresar.textContent = "Ingresar";

        acciones.prepend(ingresar);
        tarjeta.append(imagen, titulo, detalles, acciones);

        lista.appendChild(tarjeta);
    });
}

// CANCELAR EDICION

btnCancelar.addEventListener("click", function() {
    reiniciarFormulario();
    mensaje.textContent = "";
});

// REGISTRAR O ACTUALIZAR MASCOTA
// El id de la mascota lo genera la base de datos, así que la foto se guarda con un
// nombre aleatorio (usuario/uuid.jpg) y la ruta se anota en la fila.

formulario.addEventListener("submit", async function(event) {
    event.preventDefault();

if (!usuario) return;

if (!selectCategoria.value || selectCategoria.disabled) {
    mensaje.textContent = "Selecciona una categoría válida.";
    return;
}


    btnGuardar.disabled = true;
    mensaje.textContent = "";

    let rutaSubida = null;
    const editando = idEditando !== null;

    try {
        let fotoPath = fotoAnteriorPath;

        if (fotoInput.files.length > 0) {
            const blob = await procesarImagen(fotoInput.files[0]);
            const ruta = usuario.id + "/" + crypto.randomUUID() + ".jpg";

            const { error: errorSubida } = await db.storage
                .from(BUCKET_FOTOS)
                .upload(ruta, blob, { contentType: "image/jpeg" });

            if (errorSubida) throw errorSubida;

            rutaSubida = ruta;
            fotoPath = ruta;
        }

            const datos = {
                m_nombre: document.getElementById("nombre").value.trim(),
                especie: document.getElementById("especie").value,
                id_categoria: Number(selectCategoria.value),

                raza: document.getElementById("raza").value.trim() || null,
                m_edad: Number(document.getElementById("edad").value),
                m_peso: document.getElementById("peso").value
                    ? Number(document.getElementById("peso").value)
                    : null,
                foto_path: fotoPath
            };

        const resultado = editando
            ? await db.from("mascota").update(datos).eq("id_mascota", idEditando)
            : await db.from("mascota").insert(datos);

        if (resultado.error) {
            // No dejar una foto huérfana en Storage si no se pudo guardar la fila
            if (rutaSubida) {
                await db.storage.from(BUCKET_FOTOS).remove([rutaSubida]);
            }
            throw resultado.error;
        }

        // Si se cambió la foto de una mascota existente, borrar la anterior
        if (editando && rutaSubida && fotoAnteriorPath) {
            await db.storage.from(BUCKET_FOTOS).remove([fotoAnteriorPath]);
        }

        await cargarMascotas();
        reiniciarFormulario();
        mostrarMascotas();

        mensaje.textContent = editando
            ? "¡Perfil actualizado correctamente!"
            : "¡Mascota registrada correctamente!";


} catch (error) {

    console.error("ERROR AL GUARDAR MASCOTA:", error);

    mensaje.textContent =
        "Error: " + (error.message || "Desconocido") +
        " | Código: " + (error.code || "Sin código");

} finally {
    btnGuardar.disabled = false;
}

});

// INICIO

async function iniciar() {
    usuario = await requiereAuth();

    if (!usuario) return;

    mensajeVacio.textContent = "Cargando tus mascotas…";
    mensajeVacio.hidden = false;

    try {
        await cargarMascotas();
        mostrarMascotas();
    } catch (error) {
        console.error(error);
        mensajeVacio.textContent =
            "No pudimos cargar tus mascotas. Intenta recargar la página.";
    }
}

iniciar();
