document.addEventListener("DOMContentLoaded", () => {

    // MENÚ HAMBURGUESA

    const consultaMovil =
        window.matchMedia("(max-width: 650px)");

    document.querySelectorAll(".navbar").forEach((navbar, indice) => {

        const enlaces = navbar.querySelector(".nav-links");

        if (!enlaces) return;

        navbar.classList.add("nav-movil");

        if (!navbar.querySelector(".nav-cuenta")) {
            navbar.classList.add("sin-cuenta");
        }

        if (!enlaces.id) {
            enlaces.id = `menu-navegacion-${indice}`;
        }

        // Crear botón hamburguesa

        const boton = document.createElement("button");

        boton.type = "button";
        boton.className = "btn-menu-movil";
        boton.textContent = "☰";

        boton.setAttribute("aria-label", "Abrir menú");
        boton.setAttribute("aria-expanded", "false");
        boton.setAttribute("aria-controls", enlaces.id);

        enlaces.before(boton);

        function cerrarMenu() {

            navbar.classList.remove("menu-abierto");

            boton.textContent = "☰";
            boton.setAttribute("aria-expanded", "false");
            boton.setAttribute("aria-label", "Abrir menú");

        }

        boton.addEventListener("click", () => {

            const abierto =
                navbar.classList.toggle("menu-abierto");

            boton.textContent = abierto ? "×" : "☰";

            boton.setAttribute("aria-expanded", String(abierto));

            boton.setAttribute(
                "aria-label",
                abierto ? "Cerrar menú" : "Abrir menú"
            );

        });

        // Cerrar al seleccionar un enlace

        enlaces.addEventListener("click", evento => {

            if (evento.target.closest("a")) {
                cerrarMenu();
            }

        });

        // Cerrar al presionar fuera del menú

        document.addEventListener("click", evento => {

            if (!navbar.contains(evento.target)) {
                cerrarMenu();
            }

        });

        // Cerrar con Escape

        document.addEventListener("keydown", evento => {

            if (evento.key === "Escape" &&
                navbar.classList.contains("menu-abierto")) {

                cerrarMenu();
                boton.focus();

            }

        });

        consultaMovil.addEventListener("change", cerrarMenu);

    });

        // CARRUSELES MÓVILES

    function crearCarrusel(selector, nombre) {

        const pista = document.querySelector(selector);

        if (!pista) return;

        const tarjetas = Array.from(pista.children);

        if (tarjetas.length < 2) return;

        const contenedor = document.createElement("div");

        contenedor.className = "carrusel-movil";

        // Flecha izquierda

        const anterior = document.createElement("button");

        anterior.type = "button";
        anterior.className = "carrusel-flecha";
        anterior.textContent = "‹";

        anterior.setAttribute(
            "aria-label",
            `${nombre}: anterior`
        );

        // Flecha derecha

        const siguiente = document.createElement("button");

        siguiente.type = "button";
        siguiente.className = "carrusel-flecha";
        siguiente.textContent = "›";

        siguiente.setAttribute(
            "aria-label",
            `${nombre}: siguiente`
        );

        // Construir carrusel

        pista.before(contenedor);

        contenedor.append(
            anterior,
            pista,
            siguiente
        );

        // Determinar la tarjeta actualmente visible

        function obtenerIndiceActual() {

            let indice = 0;
            let distanciaMinima = Infinity;

            tarjetas.forEach((tarjeta, i) => {

                const distancia = Math.abs(
                    tarjeta.offsetLeft - pista.scrollLeft
                );

                if (distancia < distanciaMinima) {

                    distanciaMinima = distancia;
                    indice = i;

                }

            });

            return indice;

        }

        // Desplazamiento circular

        function moverCarrusel(direccion) {

            const actual = obtenerIndiceActual();

            const destino =
                (actual + direccion + tarjetas.length) %
                tarjetas.length;

            pista.scrollTo({

                left: tarjetas[destino].offsetLeft,

                behavior: window.matchMedia(
                    "(prefers-reduced-motion: reduce)"
                ).matches ? "auto" : "smooth"

            });

        }

        anterior.addEventListener("click", () => {

            moverCarrusel(-1);

        });

        siguiente.addEventListener("click", () => {

            moverCarrusel(1);

        });

    }


    // Carrusel de animales

    crearCarrusel(
        ".seccion-animales .selector-animales",
        "Tipos de animales"
    );


    // Carrusel de integrantes

    crearCarrusel(
        ".grid-equipo",
        "Integrantes del equipo"
    );
});