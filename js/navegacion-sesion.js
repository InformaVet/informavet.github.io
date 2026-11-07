
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

                window.location.href = "../";

            });

            // Enlace al panel solo para administradores (la seguridad real
            // está en la base de datos; esto solo evita mostrar un enlace inútil)
            if (await esAdmin()) {
                const enlaceAdmin = document.createElement("a");
                enlaceAdmin.href = "paginas/admin.html";
                enlaceAdmin.textContent = "Administración";
                enlaceMascotas.after(enlaceAdmin);
            }

        } else {

            enlaceMascotas.href = "paginas/login.html";

            enlaceCuenta.textContent = "Iniciar Sesión";
            enlaceCuenta.href = "paginas/login.html";

        }

    } catch (error) {
        console.error("Error de autenticación:", error);
    }
}

configurarNavegacion();
