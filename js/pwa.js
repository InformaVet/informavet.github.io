// Registra el service worker (permite instalar InformaVet como app y abrirla sin conexión).
// Funciona igual desde la raíz o desde /paginas/: la ruta se calcula a partir de este archivo.
(function () {
    if (!("serviceWorker" in navigator)) return;

    const raiz = new URL("../", document.currentScript.src);

    window.addEventListener("load", function () {
        navigator.serviceWorker
            .register(new URL("sw.js", raiz).href, { scope: raiz.href })
            .catch(function (error) {
                console.warn("No se pudo registrar el service worker:", error);
            });
    });
})();
