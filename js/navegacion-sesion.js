// Determinar la raíz del proyecto

const raizNavegacion = new URL(
    "../",
    document.currentScript.src
);


async function configurarNavegacion() {

    const enlaceMascotas =
        document.getElementById("enlace-mascotas");

    const enlaceCuenta =
        document.getElementById("enlace-cuenta");

    const enlaceServicioMascotas =
        document.getElementById("enlace-servicio-mascotas");

    if (!enlaceMascotas || !enlaceCuenta) return;


    const urlLogin = new URL(
        "paginas/login.html",
        raizNavegacion
    );

    if (window.location.pathname.endsWith("/identificador.html")) {
        urlLogin.searchParams.set("destino", "identificador");
    }

    const urlMascotas = new URL(
        "paginas/perfil_mascota.html",
        raizNavegacion
    );


    try {

        const usuario = await obtenerUsuario();

        if (usuario) {

            enlaceMascotas.href = urlMascotas.href;

            if (enlaceServicioMascotas) {
                enlaceServicioMascotas.href = urlMascotas.href;
            }

            enlaceCuenta.textContent = "Cerrar sesión";
            enlaceCuenta.href = "#";

            enlaceCuenta.addEventListener("click", async evento => {

                evento.preventDefault();

                const { error } = await cerrarSesion();

                if (error) {

                    console.error(error);

                    alert("No se pudo cerrar la sesión");

                    return;

                }

                window.location.href = raizNavegacion.href;

            });

            // PANEL DE ADMINISTRACIÓN

            if (await esAdmin()) {

                const enlaceAdmin =
                    document.createElement("a");

                enlaceAdmin.href = new URL(
                    "paginas/admin.html",
                    raizNavegacion
                ).href;

                enlaceAdmin.textContent = "Administración";

                enlaceMascotas.after(enlaceAdmin);

            }

        } else {

            enlaceMascotas.href = new URL(
                "paginas/login.html",
                raizNavegacion
            ).href;

            enlaceCuenta.textContent = "Iniciar Sesión";
            enlaceCuenta.href = urlLogin.href;

        }

    } catch (error) {

        console.error("Error de autenticación:", error);

    }

}

configurarNavegacion();