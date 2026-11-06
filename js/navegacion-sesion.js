
async function configurarNavegacion() {

    const enlaceMascotas =
        document.getElementById("enlace-mascotas");

    const enlaceCuenta =
        document.getElementById("enlace-cuenta");

    if (!enlaceMascotas || !enlaceCuenta) {
        console.error("No se encontraron los enlaces de navegación");
        return;
    }

    try {
        const usuario = await obtenerUsuario();

        if (usuario) {

            console.log("Sesión activa:", usuario.email);

            enlaceMascotas.href =
                "paginas/perfil_mascota.html";

            enlaceCuenta.textContent = "Cerrar sesión";
            enlaceCuenta.href = "#";

            enlaceCuenta.addEventListener("click", async function(event) {

                event.preventDefault();

                const { error } = await cerrarSesion();

                if (error) {
                    console.error("Error al cerrar sesión:", error);
                    alert("No se pudo cerrar la sesión");
                    return;
                }

                console.log("Sesión cerrada correctamente");

                window.location.href = "../";

            });

        } else {

            console.log("No hay sesión activa");

            enlaceMascotas.href = "paginas/login.html";

            enlaceCuenta.textContent = "Iniciar Sesión";
            enlaceCuenta.href = "paginas/login.html";

        }

    } catch (error) {
        console.error("Error de autenticación:", error);
    }
}

configurarNavegacion();
