// Service worker de InformaVet.
// Estrategia: red primero, caché como respaldo. Así siempre se ve la versión más nueva del
// sitio y, sin conexión, se abren las páginas ya visitadas (o una pantalla de "sin conexión").
// Solo se toca el propio sitio: Supabase, el CDN y las imágenes externas pasan directo
// a la red, de modo que ningún dato de usuarios ni sesión se guarda en el caché.

const CACHE = "informavet-v1";
const PRECARGA = ["offline.html", "recursos/iconos/icon-192.png"];

self.addEventListener("install", function (evento) {
    evento.waitUntil(
        caches.open(CACHE)
            .then(function (cache) { return cache.addAll(PRECARGA); })
            .then(function () { return self.skipWaiting(); })
    );
});

self.addEventListener("activate", function (evento) {
    evento.waitUntil(
        caches.keys()
            .then(function (claves) {
                return Promise.all(
                    claves
                        .filter(function (clave) { return clave !== CACHE; })
                        .map(function (clave) { return caches.delete(clave); })
                );
            })
            .then(function () { return self.clients.claim(); })
    );
});

self.addEventListener("fetch", function (evento) {
    const peticion = evento.request;
    if (peticion.method !== "GET") return;

    const url = new URL(peticion.url);
    if (url.origin !== self.location.origin) return;

    evento.respondWith(
        fetch(peticion)
            .then(function (respuesta) {
                if (respuesta.ok) {
                    const copia = respuesta.clone();
                    caches.open(CACHE).then(function (cache) { cache.put(peticion, copia); });
                }
                return respuesta;
            })
            .catch(function () {
                return caches.match(peticion).then(function (guardada) {
                    if (guardada) return guardada;
                    if (peticion.mode === "navigate") return caches.match("offline.html");
                    return Response.error();
                });
            })
    );
});
