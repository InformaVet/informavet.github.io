
const formulario = document.getElementById("form-mascota");
const lista = document.getElementById("lista-mascotas");
const mensajeVacio = document.getElementById("mensaje-vacio");

const fotoInput = document.getElementById("foto");
const vistaFoto = document.getElementById("vista-foto");
const mensaje = document.getElementById("mensaje-mascota");

const tituloFormulario = document.getElementById("titulo-formulario");
const btnGuardar = document.getElementById("btn-guardar");
const btnCancelar = document.getElementById("btn-cancelar");

const clave = "informavet_mascotas_demo";

let mascotas = [];
let idEditando = null;
let fotoAnterior = "";
let urlTemporal = null;

// RECUPERAR MASCOTAS GUARDADAS

try {
    const datos = JSON.parse(localStorage.getItem(clave) || "[]");
    mascotas = Array.isArray(datos) ? datos : [];
} catch (error) {
    console.error("No se pudieron cargar las mascotas:", error);
}

// GUARDAR DATOS

function guardarDatos(nuevasMascotas) {
    localStorage.setItem(clave, JSON.stringify(nuevasMascotas));
    mascotas = nuevasMascotas;
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
        mostrarFoto(fotoAnterior);
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
        mostrarFoto(fotoAnterior);
        return;
    }

    if (archivo.size > 5 * 1024 * 1024) {
        mensaje.textContent = "La imagen supera los 5 MB.";
        fotoInput.value = "";
        mostrarFoto(fotoAnterior);
        return;
    }

    mensaje.textContent = "";
    urlTemporal = URL.createObjectURL(archivo);
    mostrarFoto(urlTemporal);
});

// REDUCIR LA IMAGEN PARA GUARDARLA

function procesarImagen(archivo) {
    return new Promise(function(resolve, reject) {
        const imagen = new Image();
        const url = URL.createObjectURL(archivo);

        imagen.onload = function() {
            try {
                const escala = Math.min(
                    1,
                    320 / Math.max(imagen.width, imagen.height)
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

                const resultado = canvas.toDataURL(
                    "image/jpeg", 0.75
                );

                URL.revokeObjectURL(url);
                resolve(resultado);

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

    idEditando = null;
    fotoAnterior = "";

    limpiarUrlTemporal();
    mostrarFoto("");

    tituloFormulario.textContent = "Registrar una mascota";
    btnGuardar.textContent = "Guardar mascota";
    btnCancelar.hidden = true;
}

// MOSTRAR PERFILES

function mostrarMascotas() {
    lista.innerHTML = "";

    mensajeVacio.hidden = mascotas.length > 0;

    mascotas.forEach(function(mascota) {
        const tarjeta = document.createElement("article");
        tarjeta.className = "tarjeta-mascota";

        const iconos = {
            Perro: "perro",
            Gato: "gato",
            Ave: "gallina",
            Conejo: "conejo",
            "Animal exótico": "exotico",
            Otro: "otro"
        };

        let imagen;

        if (mascota.foto) {
            imagen = document.createElement("img");
            imagen.src = mascota.foto;
            imagen.alt = "Foto de " + mascota.nombre;
            imagen.className = "foto-mascota";
        } else {
            imagen = document.createElement("div");
            imagen.className = "icono-mascota";
            imagen.textContent = iconos[mascota.especie] || "🐾";
        }

        const titulo = document.createElement("h3");
        titulo.textContent = mascota.nombre;

        const detalles = document.createElement("p");

        detalles.textContent =
            "Tipo: " + mascota.especie +
            "\nRaza: " + (mascota.raza || "No especificada") +
            "\nEdad: " + mascota.edad + " años" +
            "\nPeso: " + (
                mascota.peso ? mascota.peso + " kg" : "No indicado"
            );

        // BOTON EDITAR

        const editar = document.createElement("button");
        editar.type = "button";
        editar.className = "btn-editar";
        editar.textContent = "Editar perfil";

        editar.addEventListener("click", function() {
            idEditando = mascota.id;

            document.getElementById("nombre").value = mascota.nombre;
            document.getElementById("especie").value = mascota.especie;
            document.getElementById("raza").value = mascota.raza || "";
            document.getElementById("edad").value = mascota.edad;
            document.getElementById("peso").value = mascota.peso || "";

            fotoAnterior = mascota.foto || "";
            fotoInput.value = "";

            limpiarUrlTemporal();
            mostrarFoto(fotoAnterior);

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

        eliminar.addEventListener("click", function() {
            if (!confirm("¿Eliminar a " + mascota.nombre + "?")) {
                return;
            }

            try {
                const nuevas = mascotas.filter(
                    m => m.id !== mascota.id
                );

                guardarDatos(nuevas);

                if (idEditando === mascota.id) {
                    reiniciarFormulario();
                }

                mostrarMascotas();
            } catch (error) {
                mensaje.textContent = "No se pudo eliminar el perfil.";
            }
        });

        const acciones = document.createElement("div");
        acciones.className = "acciones-tarjeta";

        acciones.append(editar, eliminar);
        const ingresar = document.createElement("a");

        ingresar.href = "ficha_mascota.html?id=" +
            encodeURIComponent(mascota.id);

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

formulario.addEventListener("submit", async function(event) {
    event.preventDefault();

    btnGuardar.disabled = true;

    try {
        let foto = fotoAnterior;

        if (fotoInput.files.length > 0) {
            foto = await procesarImagen(fotoInput.files[0]);
        }

        const editando = idEditando !== null;

        const idNuevo = (
            crypto.randomUUID
                ? crypto.randomUUID()
                : String(Date.now()) + "-" + Math.random()
        );

        const mascota = {
            id: editando ? idEditando : idNuevo,
            nombre: document.getElementById("nombre").value.trim(),
            especie: document.getElementById("especie").value,
            raza: document.getElementById("raza").value.trim(),
            edad: document.getElementById("edad").value,
            peso: document.getElementById("peso").value,
            foto: foto
        };

        let nuevasMascotas;

        if (editando) {
            nuevasMascotas = mascotas.map(function(m) {
                return m.id === idEditando ? mascota : m;
            });
        } else {
            nuevasMascotas = [...mascotas, mascota];
        }

        guardarDatos(nuevasMascotas);

        reiniciarFormulario();
        mostrarMascotas();

        mensaje.textContent = editando
            ? "¡Perfil actualizado correctamente!"
            : "¡Mascota registrada correctamente!";

    } catch (error) {
        console.error(error);
        mensaje.textContent =
            "No se pudo guardar. Revisa la imagen o el espacio disponible.";
    } finally {
        btnGuardar.disabled = false;
    }
});

mostrarMascotas();
