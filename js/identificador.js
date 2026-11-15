document.addEventListener("DOMContentLoaded", async () => {

    const inputFoto =
        document.getElementById("fotoMascotaInput");

    const vistaPrevia =
        document.getElementById("previewFoto");

    const zonaCarga =
        document.getElementById("zona-carga");

    const botonSubir =
        document.getElementById("etiquetaSubirFoto");

    const enlaceLogin =
        document.getElementById("loginParaIA");

    const cargando =
        document.getElementById("cargandoIA");

    const resultado =
        document.getElementById("resultadoIdentificacion");

    const botonOtraFoto =
        document.getElementById("btnOtraFoto");

    const enlaceCuidados =
        document.getElementById("enlaceCuidadosIA");

    let sesionActiva = false;
    let procesando = false;
    let urlPrevia = null;


    // PROCESAR IMAGEN

    async function seleccionarFoto(archivo) {

        if (!sesionActiva) {

            mostrarEstadoIA(
                "Debes iniciar sesión para utilizar esta herramienta.",
                true
            );

            return;
        }

        if (!archivo) {

            mostrarEstadoIA(
                "No se detectó ningún archivo de imagen.",
                true
            );

            return;
        }

        if (procesando) {

            mostrarEstadoIA(
                "Ya estamos analizando una fotografía.",
                false
            );

            return;
        }

        if (!TIPOS_FOTO.includes(archivo.type)) {

            mostrarEstadoIA(
                "Selecciona una imagen JPG, PNG o WebP.",
                true
            );

            return;
        }

        if (archivo.size > MAX_BYTES_FOTO) {

            mostrarEstadoIA(
                "La imagen supera los 10 MB.",
                true
            );

            return;
        }

        procesando = true;

        botonSubir.disabled = true;

        resultado.style.display = "none";
        enlaceCuidados.hidden = true;

        cargando.hidden = false;

        // Mostrar vista previa

        if (urlPrevia) {
            URL.revokeObjectURL(urlPrevia);
        }

        urlPrevia = URL.createObjectURL(archivo);

        vistaPrevia.src = urlPrevia;
        vistaPrevia.style.display = "block";

        try {

            const datos = await procesarFotoMascota(archivo);

            if (!datos) return;

            // Redirigir según la especie identificada

            const especies = {
                perro: "Canino",
                gato: "Felino"
            };

            const especie = especies[datos.animal];

            if (especie) {

                enlaceCuidados.href =
                    "filtros.html?animal=" +
                    encodeURIComponent(especie);

                enlaceCuidados.hidden = false;
            }

        } catch (error) {

            console.error(error);

            mostrarEstadoIA(
                "Ocurrió un error al analizar la fotografía.",
                true
            );

        } finally {

            procesando = false;

            cargando.hidden = true;

            botonSubir.disabled = false;

            inputFoto.value = "";
        }

    }


    // SELECCIONAR IMAGEN DESDE EL DISPOSITIVO

    function abrirSelector() {

        if (sesionActiva && !procesando) {
            inputFoto.click();
        }

    }

    botonSubir.addEventListener("click", abrirSelector);

    botonOtraFoto.addEventListener("click", abrirSelector);

    inputFoto.addEventListener("change", evento => {

        const archivo = evento.target.files[0];

        inputFoto.value = "";

        seleccionarFoto(archivo);
    });


    // ARRASTRAR Y SOLTAR

    zonaCarga.addEventListener("dragover", evento => {

        evento.preventDefault();

        if (sesionActiva && !procesando) {
            zonaCarga.classList.add("arrastrando");
        }

    });

    zonaCarga.addEventListener("dragleave", evento => {

        if (!zonaCarga.contains(evento.relatedTarget)) {
            zonaCarga.classList.remove("arrastrando");
        }

    });

    zonaCarga.addEventListener("drop", evento => {

        evento.preventDefault();
        evento.stopPropagation();

        zonaCarga.classList.remove("arrastrando");

        const archivos = evento.dataTransfer.files;

        if (archivos.length === 0) {

            mostrarEstadoIA(
                "Arrastra una imagen desde una carpeta de tu dispositivo.",
                true
            );

            return;
        }

        const archivo = archivos[0];

        console.log("Archivo recibido:", archivo);

        seleccionarFoto(archivo);
    });


    // COMPROBAR AUTENTICACIÓN

    try {

        const usuario = await obtenerUsuario();

        sesionActiva = Boolean(usuario);

        botonSubir.hidden = !sesionActiva;
        enlaceLogin.hidden = sesionActiva;

        mostrarEstadoIA("", false);

    } catch (error) {

        mostrarEstadoIA(
            "No se pudo comprobar tu sesión. Intenta nuevamente.",
            true
        );

    }

});