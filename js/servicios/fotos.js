// ===============================================================
// Identificador de raza por foto (versión directa, sin Supabase)
// Las claves se leen de js/config.js
// ===============================================================

const MODELOS_GEMINI = ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.1-flash-lite"];

const LOCAL_BREEDS = {
    quiltro: {
        name: "Quiltro Chileno",
        temperament: "Leal, inteligente, cariñoso, noble y resistente",
        life_span: "12 - 16 años",
        origin: "Chile"
    },
    comun_mestizo: {
        name: "Mestizo / Común",
        temperament: "Afectuoso, juguetón y adaptable",
        life_span: "12 - 15 años",
        origin: "Desconocido"
    }
};

const PROMPT = `Analiza la imagen de la mascota. Determina si es un perro o un gato, estima su raza o mestizaje principal, su patrón de pelaje y el código ID más cercano para TheCatAPI (ej: 'esho', 'siam') o TheDogAPI. Si es un perro mestizo chileno, usa "api_target": "local" y "api_breed_id": "quiltro".
Responde estrictamente con este esquema JSON:
{
    "animal": "gato" | "perro" | "otro",
    "raza_estimada": "Nombre de raza",
    "patron_o_subtipo": "Patrón visual",
    "api_target": "catapi" | "dogapi" | "local",
    "api_breed_id": "id_codigo"
}`;

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = (error) => reject(error);
    });
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Llama a Gemini; si está saturado (503) reintenta y luego prueba el modelo de respaldo
async function llamarGemini(body) {
    let ultimoError = "";

    for (const modelo of MODELOS_GEMINI) {
        for (let intento = 1; intento <= 3; intento++) {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": CONFIG.GEMINI_API_KEY
                    },
                    body: JSON.stringify(body)
                }
            );

            if (response.ok) return await response.json();

            ultimoError = `${modelo} ${response.status}: ${await response.text()}`;

            if (response.status === 404) break;                       // modelo no disponible, probar el siguiente
            if (![429, 500, 503, 504].includes(response.status)) {    // error permanente (clave mala, etc.)
                throw new Error(ultimoError);
            }
            await esperar(1000 * intento);                            // espera 1s, 2s, 3s
        }
    }
    throw new Error(ultimoError);
}

async function clasificarMascotaConGemini(base64Image, mimeType = "image/jpeg") {
    const data = await llamarGemini({
        contents: [{
            parts: [
                { text: PROMPT },
                { inline_data: { mime_type: mimeType, data: base64Image } }
            ]
        }],
        generationConfig: { response_mime_type: "application/json" }
    });

    const texto = data.candidates[0].content.parts.map((p) => p.text || "").join("");
    return JSON.parse(texto);
}

async function obtenerDetallesRaza(clasificacion) {
    const { api_target, api_breed_id, raza_estimada } = clasificacion;
    try {
        if (api_target === "catapi") {
            const h = { headers: { "x-api-key": CONFIG.CAT_API_KEY } };
            const res = await fetch(`https://api.thecatapi.com/v1/breeds/${encodeURIComponent(api_breed_id)}`, h);
            if (res.ok) return await res.json();
            const searchRes = await fetch(`https://api.thecatapi.com/v1/breeds/search?q=${encodeURIComponent(raza_estimada)}`, h);
            return (await searchRes.json())[0] || null;
        } else if (api_target === "dogapi") {
            const searchRes = await fetch(
                `https://api.thedogapi.com/v1/breeds/search?q=${encodeURIComponent(raza_estimada)}`,
                { headers: { "x-api-key": CONFIG.DOG_API_KEY } }
            );
            return (await searchRes.json())[0] || null;
        } else if (api_target === "local") {
            return LOCAL_BREEDS[api_breed_id] || LOCAL_BREEDS.comun_mestizo;
        }
    } catch (err) {
        console.warn("Error API razas:", err);
    }
    return null;
}

async function procesarFotoMascota(file) {
    const indicador = document.getElementById("estadoCarga");
    const contenedor = document.getElementById("resultadoIdentificacion");

    try {
        if (indicador) { indicador.innerText = "Analizando la foto con IA..."; indicador.style.display = "block"; }
        if (contenedor) contenedor.style.display = "none";

        const base64 = await fileToBase64(file);
        const clasificacion = await clasificarMascotaConGemini(base64, file.type);
        const detalles = await obtenerDetallesRaza(clasificacion);

        document.getElementById("resAnimal").innerText = clasificacion.animal.toUpperCase();
        document.getElementById("resRaza").innerText = clasificacion.raza_estimada;
        document.getElementById("resPatron").innerText = clasificacion.patron_o_subtipo;
        document.getElementById("resTemperamento").innerText = detalles?.temperament || "Cariñoso y leal";
        document.getElementById("resEsperanza").innerText = detalles?.life_span || "12 - 15 años";
        document.getElementById("resOrigen").innerText = detalles?.origin || "Desconocido";

        if (contenedor) contenedor.style.display = "block";
    } catch (error) {
        console.error("Error:", error);
        alert("No se pudo identificar la mascota. Intenta de nuevo en unos segundos.");
    } finally {
        if (indicador) indicador.style.display = "none";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const inputFoto = document.getElementById("fotoMascotaInput");
    const vistaPrevia = document.getElementById("previewFoto");

    if (inputFoto) {
        inputFoto.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (vistaPrevia) {
                vistaPrevia.src = URL.createObjectURL(file);
                vistaPrevia.style.display = "block";
            }
            procesarFotoMascota(file);
        });
    }
});