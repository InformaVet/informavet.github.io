
// FICHA DE LA MASCOTA
// Datos e historial desde Supabase. Si la mascota no existe o es de otra persona,
// la base de datos no la devuelve y se muestra el aviso de "no encontrada".
// Depende de cliente-supabase.js y autenticacion.js (cargados antes en el HTML).

const parametros = new URLSearchParams(window.location.search);
const mascotaId = parametros.get("id");

const contenido = document.getElementById("contenido-ficha");
const avisoError = document.getElementById("error-mascota");

const BUCKET_FOTOS = "fotos-mascotas";
const FORMATO_ID = /^[0-9]{1,9}$/;

const iconos = {
    Perro: "perro",
    Gato: "gato",
    Ave: "gallina",
    Conejo: "conejo",
    "Animal exótico": "exotico",
    Otro: "otro"
};

let registros = [];

function mostrarError(texto) {
    avisoError.textContent = texto || "No se encontró la mascota seleccionada.";
    avisoError.hidden = false;
}

// CARGAR HISTORIAL

async function cargarRegistros() {
    const { data, error } = await db
        .from("historial_mascota")
        .select("*")
        .eq("mascota_id", Number(mascotaId))
        .order("fecha", { ascending: false });

    if (error) throw error;
    registros = data;
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

            eliminar.addEventListener("click", async function() {
                const confirmar = confirm(
                    "¿Deseas eliminar este registro?"
                );

                if (!confirmar) return;

                eliminar.disabled = true;

                const { error } = await db
                    .from("historial_mascota")
                    .delete()
                    .eq("id", registro.id);

                if (error) {
                    console.error(error);
                    alert("No se pudo eliminar el registro.");
                    eliminar.disabled = false;
                    return;
                }

                registros = registros.filter(
                    r => r.id !== registro.id
                );

                mostrarRegistros();
            });

            item.append(datos, eliminar);
            lista.appendChild(item);
        });
    });
}

// AGREGAR CONTROLES O VACUNAS

function activarFormularios() {
    document.querySelectorAll(".form-ficha").forEach(
        function(formulario) {

            formulario.addEventListener("submit", async function(event) {
                event.preventDefault();

                const tipo = formulario.dataset.tipo;

                const descripcion = formulario.elements
                    .namedItem("descripcion").value.trim();

                const fecha = formulario.elements
                    .namedItem("fecha").value;

                const estado = formulario.elements
                    .namedItem("estado").value;

                if (!descripcion || !fecha) return;

                const boton = formulario.querySelector("button[type=submit]");
                boton.disabled = true;

                const { data, error } = await db
                    .from("historial_mascota")
                    .insert({
                        mascota_id: Number(mascotaId),
                        tipo: tipo,
                        descripcion: descripcion,
                        fecha: fecha,
                        estado: estado
                    })
                    .select()
                    .single();

                boton.disabled = false;

                if (error) {
                    console.error(error);
                    alert("No se pudo guardar el registro.");
                    return;
                }

                registros = [data, ...registros];
                formulario.reset();
                mostrarRegistros();
            });
        }
    );
}

// INICIO

async function iniciar() {
    const usuario = await requiereAuth();
    if (!usuario) return;

    if (!mascotaId || !FORMATO_ID.test(mascotaId)) {
        mostrarError();
        return;
    }

    const { data: mascota, error } = await db
        .from("mascota")
        .select("*")
        .eq("id_mascota", Number(mascotaId))
        .maybeSingle();

    if (error) {
        console.error(error);
        mostrarError("No pudimos cargar la ficha. Intenta de nuevo.");
        return;
    }

    if (!mascota) {
        mostrarError();
        return;
    }

    contenido.hidden = false;

    // MOSTRAR INFORMACION DE LA MASCOTA

    document.getElementById("nombre-ficha").textContent =
        mascota.m_nombre;

    document.getElementById("informacion-ficha").textContent =
        "Tipo: " + mascota.especie +
        "\nRaza: " + (mascota.raza || "No especificada") +
        "\nEdad: " + mascota.m_edad + " años" +
        "\nPeso: " + (
            mascota.m_peso ? mascota.m_peso + " kg" : "No indicado"
        );

    // MOSTRAR FOTO (bucket privado: URL firmada de 1 hora)

    const fotoFicha = document.getElementById("foto-ficha");
    let urlFoto = null;

    if (mascota.foto_path) {
        const { data: firmada } = await db.storage
            .from(BUCKET_FOTOS)
            .createSignedUrl(mascota.foto_path, 3600);

        urlFoto = firmada ? firmada.signedUrl : null;
    }

    if (urlFoto) {
        const imagen = document.createElement("img");
        imagen.src = urlFoto;
        imagen.alt = "Foto de " + mascota.m_nombre;
        fotoFicha.appendChild(imagen);

    } else {
        const icono = document.createElement("div");
        icono.className = "icono-mascota";
        icono.textContent = iconos[mascota.especie] || "🐾";

        fotoFicha.appendChild(icono);
    }

    // HISTORIAL

    activarFormularios();

    try {
        await cargarRegistros();
    } catch (error) {
        console.error("Error al cargar historial:", error);
    }

    mostrarRegistros();
}

iniciar();
