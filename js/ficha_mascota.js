
// IDENTIFICAR MASCOTA SELECCIONADA

const parametros = new URLSearchParams(window.location.search);
const mascotaId = parametros.get("id");

const claveMascotas = "informavet_mascotas_demo";

let mascotas = [];

try {
    const datos = JSON.parse(
        localStorage.getItem(claveMascotas) || "[]"
    );

    mascotas = Array.isArray(datos) ? datos : [];
} catch (error) {
    console.error("Error al cargar mascotas:", error);
}

const mascota = mascotas.find(
    m => String(m.id) === mascotaId
);

const contenido = document.getElementById("contenido-ficha");
const avisoError = document.getElementById("error-mascota");

if (!mascota) {
    avisoError.hidden = false;

} else {
    contenido.hidden = false;

    // MOSTRAR INFORMACION DE LA MASCOTA

    document.getElementById("nombre-ficha").textContent =
        mascota.nombre;

    document.getElementById("informacion-ficha").textContent =
        "Tipo: " + mascota.especie +
        "\nRaza: " + (mascota.raza || "No especificada") +
        "\nEdad: " + mascota.edad + " años" +
        "\nPeso: " + (
            mascota.peso ? mascota.peso + " kg" : "No indicado"
        );

    // MOSTRAR FOTO

    const fotoFicha = document.getElementById("foto-ficha");

    if (mascota.foto) {
        const imagen = document.createElement("img");
        imagen.src = mascota.foto;
        imagen.alt = "Foto de " + mascota.nombre;
        fotoFicha.appendChild(imagen);

    } else {
        const iconos = {
            Perro: "perro",
            Gato: "gato",
            Ave: "gallina",
            Conejo: "conejo",
            "Animal exótico": "exotico",
            Otro: "otro"
        };

        const icono = document.createElement("div");
        icono.className = "icono-mascota";
        icono.textContent = iconos[mascota.especie] || "🐾";

        fotoFicha.appendChild(icono);
    }

    // ALMACENAMIENTO LOCAL POR MASCOTA

    const claveHistorial =
        "informavet_historial_demo_" + mascotaId;

    let registros = [];

    try {
        const datos = JSON.parse(
            localStorage.getItem(claveHistorial) || "[]"
        );

        registros = Array.isArray(datos) ? datos : [];
    } catch (error) {
        console.error("Error al cargar historial:", error);
    }

    function guardarRegistros(nuevos) {
        try {
            localStorage.setItem(
                claveHistorial,
                JSON.stringify(nuevos)
            );

            registros = nuevos;
            return true;
        } catch (error) {
            alert("No se pudo guardar el registro local.");
            return false;
        }
    }

    // MOSTRAR CONTROLES Y VACUNAS

    function mostrarRegistros() {

        ["controles", "vacunas"].forEach(function(tipo) {

            const lista = document.getElementById(
                "lista-" + tipo
            );

            lista.replaceChildren();

            const elementos = registros.filter(
                registro => registro.tipo === tipo
            );

            if (elementos.length === 0) {
                const vacio = document.createElement("li");

                vacio.className = "sin-registros";
                vacio.textContent = "Sin registros todavía.";

                lista.appendChild(vacio);
                return;
            }

            elementos.forEach(function(registro) {

                const item = document.createElement("li");
                item.className = "registro-ficha";

                const datos = document.createElement("div");

                const nombre = document.createElement("strong");
                nombre.textContent = registro.descripcion;

                const fecha = document.createElement("p");
                fecha.textContent = "Fecha: " +
                    registro.fecha.split("-").reverse().join("/");

                const estado = document.createElement("p");
                estado.textContent = "Estado: " + registro.estado;

                datos.append(nombre, fecha, estado);

                // ELIMINAR REGISTRO

                const eliminar = document.createElement("button");
                eliminar.type = "button";
                eliminar.textContent = "Eliminar";

                eliminar.addEventListener("click", function() {
                    const confirmar = confirm(
                        "¿Deseas eliminar este registro?"
                    );

                    if (!confirmar) return;

                    const nuevos = registros.filter(
                        r => r.id !== registro.id
                    );

                    if (guardarRegistros(nuevos)) {
                        mostrarRegistros();
                    }
                });

                item.append(datos, eliminar);
                lista.appendChild(item);
            });
        });
    }

    // AGREGAR CONTROLES O VACUNAS

    document.querySelectorAll(".form-ficha").forEach(
        function(formulario) {

            formulario.addEventListener("submit", function(event) {
                event.preventDefault();

                const tipo = formulario.dataset.tipo;

                const descripcion = formulario.elements
                    .namedItem("descripcion").value.trim();

                const fecha = formulario.elements
                    .namedItem("fecha").value;

                const estado = formulario.elements
                    .namedItem("estado").value;

                if (!descripcion || !fecha) return;

                const idNuevo =
                    typeof crypto.randomUUID === "function"
                    ? crypto.randomUUID()
                    : String(Date.now()) + "-" + Math.random();

                const registro = {
                    id: idNuevo,
                    tipo: tipo,
                    descripcion: descripcion,
                    fecha: fecha,
                    estado: estado
                };

                const nuevos = [...registros, registro];

                if (guardarRegistros(nuevos)) {
                    formulario.reset();
                    mostrarRegistros();
                }
            });
        }
    );

    mostrarRegistros();
}
