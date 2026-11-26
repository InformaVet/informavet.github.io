document.addEventListener("DOMContentLoaded", async () => {

    const inputFoto =
        document.getElementById("fotoMascotaInput");

    const botonCamaraIA =
        document.getElementById("btnCamaraIA");

    const fotoCamaraIA =
        document.getElementById("fotoCamaraIA");

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

    const botonRegistrarIA =
        document.getElementById("btnRegistrarIA");

    const estadoRegistroIA =
        document.getElementById("estadoRegistroIA");

    let registroIA = null;
    let preparandoRegistro = false;
    let usuarioIAId = null;

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

        if (procesando || preparandoRegistro) {

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
        botonCamaraIA.disabled = true;

        resultado.style.display = "none";
        enlaceCuidados.hidden = true;

        botonRegistrarIA.hidden = true;

        registroIA = null;

        estadoRegistroIA.textContent = "";

        cargando.hidden = false;

        // Mostrar vista previa

        if (urlPrevia) {
            URL.revokeObjectURL(urlPrevia);
        }

        urlPrevia = URL.createObjectURL(archivo);

        vistaPrevia.src = urlPrevia;

        zonaCarga.classList.add("con-imagen");

        botonSubir.textContent = "Cambiar fotografía";

        try {

            const datos = await procesarFotoMascota(archivo);

            if (!datos) return;

            // Redirigir según la especie identificada

            const especies = {
                perro: "Canino",
                gato: "Felino",
                ave: "Ave",
                reptil: "Reptil",
                pez: "Exótico",
                exotico: "Exótico"
            };

            const especie = especies[datos.animal];

            if (especie) {

                enlaceCuidados.href =
                    "filtros.html?animal=" +
                    encodeURIComponent(especie);

                enlaceCuidados.hidden = false;

                const especiesRegistro = {
                    perro: "Perro",
                    gato: "Gato",
                    ave: "Ave",
                    reptil: "Reptil",
                    pez: "Pez",
                    exotico: "Exótico"
                };

                registroIA = {

                    especie: especiesRegistro[datos.animal],

                    raza: datos.raza_estimada || "",

                    archivo: archivo

                };

                botonRegistrarIA.hidden = false;

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
            botonCamaraIA.disabled = false;

            inputFoto.value = "";
        }

    }

    // TRANSFERIR RESULTADOS A MIS MASCOTAS

    botonRegistrarIA.addEventListener("click", async function() {

        if (
            !registroIA ||
            procesando ||
            preparandoRegistro
        ) return;

        preparandoRegistro = true;

        botonRegistrarIA.disabled = true;
        botonSubir.disabled = true;
        botonCamaraIA.disabled = true;
        botonOtraFoto.disabled = true;

        estadoRegistroIA.textContent =
            "Preparando el registro de tu mascota...";

        try {

            const usuarioActual = await obtenerUsuario();

            if (
                !usuarioActual ||
                usuarioActual.id !== usuarioIAId
            ) {
                throw new Error("La sesión ha cambiado.");
            }

            // Reducir la fotografía antes de transferirla

            const foto = await reducirFoto(
                registroIA.archivo
            );

            const datosRegistro = {

                usuarioId: usuarioActual.id,

                especie: registroIA.especie,

                raza: registroIA.raza,

                fotografia: foto.base64,

                creadoEn: Date.now()

            };

            // Almacenar temporalmente los datos

            sessionStorage.setItem(
                "informavet:registro-ia",
                JSON.stringify(datosRegistro)
            );

            // Redirigir a Mis mascotas

            window.location.href =
                "perfil_mascota.html?origen=ia";

        } catch (error) {

            console.error(
                "Error preparando el registro:",
                error
            );

            estadoRegistroIA.textContent =
                "No pudimos preparar el registro. " +
                "Comprueba tu sesión e inténtalo nuevamente.";

        } finally {

            preparandoRegistro = false;

            botonRegistrarIA.disabled = false;
            botonSubir.disabled = false;
            botonCamaraIA.disabled = false;
            botonOtraFoto.disabled = false;

        }

    });


    // SELECCIONAR IMAGEN DESDE EL DISPOSITIVO
    function abrirSelector() {

        if (
            sesionActiva &&
            !procesando &&
            !preparandoRegistro
        ) {
            inputFoto.click();
        }

    }

    botonSubir.addEventListener("click", abrirSelector);

    // ABRIR CAMARA DEL DISPOSITIVO

    botonCamaraIA.addEventListener("click", function() {

        if (
            sesionActiva &&
            !procesando &&
            !preparandoRegistro
        ) {

            fotoCamaraIA.click();

        }

    });

    // PROCESAR FOTOGRAFIA CAPTURADA

    fotoCamaraIA.addEventListener("change", function() {

        const archivo = fotoCamaraIA.files[0];

        fotoCamaraIA.value = "";

        if (archivo) {

            seleccionarFoto(archivo);

        }

    });

    botonOtraFoto.addEventListener("click", abrirSelector);

    inputFoto.addEventListener("change", evento => {

        const archivo = evento.target.files[0];

        inputFoto.value = "";

        seleccionarFoto(archivo);
    });


    // ARRASTRAR Y SOLTAR

    zonaCarga.addEventListener("dragover", evento => {

        evento.preventDefault();

        if (
            sesionActiva &&
            !procesando &&
            !preparandoRegistro
        ) {
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

        usuarioIAId = usuario ? usuario.id : null;

        botonSubir.hidden = !sesionActiva;
        enlaceLogin.hidden = sesionActiva;

        botonCamaraIA.hidden = !sesionActiva;

        mostrarEstadoIA("", false);

    } catch (error) {

        mostrarEstadoIA(
            "No se pudo comprobar tu sesión. Intenta nuevamente.",
            true
        );

    }

});