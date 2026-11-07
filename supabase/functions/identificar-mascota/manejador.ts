// Identifica la raza de una mascota a partir de una foto usando Gemini.
// Las claves (GEMINI_API_KEY, DOG_API_KEY, CAT_API_KEY) viven como secretos de Supabase
// y nunca llegan al navegador. Requiere sesión iniciada y limita el uso por persona.

import {
  leerJson,
  responderJson,
  responderOpciones,
  tokenDeSolicitud,
} from "../_shared/comun.ts";

const MODELOS_POR_DEFECTO = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite"];
const LIMITE_POR_HORA = 10;
const MAX_BASE64 = 7_000_000; // ~5 MB de imagen
const MIME_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

const RAZAS_LOCALES: Record<string, { temperament: string; life_span: string; origin: string }> = {
  quiltro: {
    temperament: "Leal, inteligente, cariñoso, noble y resistente",
    life_span: "12 - 16 años",
    origin: "Chile",
  },
  comun_mestizo: {
    temperament: "Afectuoso, juguetón y adaptable",
    life_span: "12 - 15 años",
    origin: "Desconocido",
  },
};

const PROMPT = `Analiza la imagen de la mascota. Determina si es un perro o un gato, estima su raza o mestizaje principal, su patrón de pelaje y el código ID más cercano para TheCatAPI (ej: 'esho', 'siam') o TheDogAPI. Si es un perro mestizo chileno, usa "api_target": "local" y "api_breed_id": "quiltro". Si en la imagen no se ve claramente un perro o un gato, usa "animal": "otro".
Responde estrictamente con este esquema JSON:
{
    "animal": "gato" | "perro" | "otro",
    "raza_estimada": "Nombre de raza",
    "patron_o_subtipo": "Patrón visual",
    "api_target": "catapi" | "dogapi" | "local",
    "api_breed_id": "id_codigo"
}`;

interface ClienteAdmin {
  // deno-lint-ignore no-explicit-any
  auth: { getUser: (token: string) => Promise<any> };
  // deno-lint-ignore no-explicit-any
  from: (tabla: string) => any;
}

export interface Dependencias {
  env: (nombre: string) => string | undefined;
  admin: ClienteAdmin;
  fetch: typeof fetch;
  esperar: (ms: number) => Promise<void>;
  ahora: () => number;
}

class ErrorIA extends Error {
  estado: number;
  constructor(mensaje: string, estado: number) {
    super(mensaje);
    this.estado = estado;
  }
}

async function llamarGemini(deps: Dependencias, clave: string, cuerpo: unknown) {
  const modelos = (deps.env("GEMINI_MODELS") ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  const lista = modelos.length ? modelos : MODELOS_POR_DEFECTO;
  let ultimo: ErrorIA = new ErrorIA("sin respuesta", 502);

  for (const modelo of lista) {
    for (let intento = 1; intento <= 3; intento++) {
      const respuesta = await deps.fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": clave },
          body: JSON.stringify(cuerpo),
          signal: AbortSignal.timeout(25_000),
        },
      );
      if (respuesta.ok) return await respuesta.json();

      ultimo = new ErrorIA(`${modelo} respondió ${respuesta.status}`, respuesta.status);
      if (respuesta.status === 404) break; // modelo no disponible: probar el siguiente
      if (![429, 500, 503, 504].includes(respuesta.status)) throw ultimo; // clave mala, etc.
      await deps.esperar(1000 * intento);
    }
  }
  throw ultimo;
}

function texto(valor: unknown, max: number): string {
  return typeof valor === "string" ? valor.trim().slice(0, max) : "";
}

function normalizarVida(valor: unknown): string {
  const t = texto(valor, 40);
  if (!t) return "";
  if (/^\d+(\s*-\s*\d+)?$/.test(t)) return `${t} años`;
  return t.replace(/\byears?\b/i, "años");
}

async function buscarDetalles(
  deps: Dependencias,
  animal: string,
  idRaza: string,
  nombreRaza: string,
  objetivo: string,
) {
  try {
    if (objetivo === "local") {
      return RAZAS_LOCALES[idRaza] ?? RAZAS_LOCALES.comun_mestizo;
    }
    const base = animal === "gato" ? "https://api.thecatapi.com/v1" : "https://api.thedogapi.com/v1";
    const clave = deps.env(animal === "gato" ? "CAT_API_KEY" : "DOG_API_KEY") ?? "";
    const opciones = { headers: { "x-api-key": clave }, signal: AbortSignal.timeout(6_000) };

    let raza = null;
    if (animal === "gato" && idRaza) {
      const r = await deps.fetch(`${base}/breeds/${encodeURIComponent(idRaza)}`, opciones);
      if (r.ok) raza = await r.json();
    }
    if (!raza) {
      const r = await deps.fetch(`${base}/breeds/search?q=${encodeURIComponent(nombreRaza)}`, opciones);
      if (r.ok) {
        const lista = await r.json();
        raza = Array.isArray(lista) ? lista[0] : null;
      }
    }
    if (!raza) return null;
    return {
      temperament: texto(raza.temperament, 300),
      life_span: normalizarVida(raza.life_span),
      origin: texto(raza.origin, 80),
    };
  } catch {
    return null; // los detalles son un extra: si fallan, igual se entrega la raza estimada
  }
}

export function crearManejador(deps: Dependencias) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return responderOpciones(req);
    if (req.method !== "POST") return responderJson(req, 405, { error: "metodo_no_permitido" });

    const token = tokenDeSolicitud(req);
    if (!token) return responderJson(req, 401, { error: "no_autenticado" });
    const { data: sesion, error: errorSesion } = await deps.admin.auth.getUser(token);
    const usuario = sesion?.user;
    if (errorSesion || !usuario) return responderJson(req, 401, { error: "no_autenticado" });

    const longitud = Number(req.headers.get("content-length") ?? 0);
    if (longitud > MAX_BASE64 + 2_000) return responderJson(req, 413, { error: "imagen_muy_grande" });

    const cuerpo = await leerJson(req);
    const imagen = cuerpo?.imagen;
    const mimeType = cuerpo?.mimeType;
    if (typeof imagen !== "string" || typeof mimeType !== "string" || !MIME_PERMITIDOS.includes(mimeType)) {
      return responderJson(req, 400, { error: "solicitud_invalida" });
    }
    if (imagen.length > MAX_BASE64) return responderJson(req, 413, { error: "imagen_muy_grande" });
    if (!BASE64.test(imagen)) return responderJson(req, 400, { error: "solicitud_invalida" });

    const claveGemini = deps.env("GEMINI_API_KEY");
    if (!claveGemini) {
      console.error("Falta el secreto GEMINI_API_KEY");
      return responderJson(req, 500, { error: "configuracion" });
    }

    // Límite por persona. Se cuenta el intento (no el éxito) para que reintentar no lo evada.
    const desde = new Date(deps.ahora() - 3_600_000).toISOString();
    const { count, error: errorConteo } = await deps.admin
      .from("uso_ia")
      .select("id", { count: "exact", head: true })
      .eq("user_id", usuario.id)
      .gte("creado_en", desde);
    if (errorConteo) {
      console.error("No se pudo consultar uso_ia:", errorConteo.message);
      return responderJson(req, 500, { error: "interno" });
    }
    if ((count ?? 0) >= LIMITE_POR_HORA) {
      return responderJson(req, 429, {
        error: "limite",
        mensaje: `Llegaste al límite de ${LIMITE_POR_HORA} identificaciones por hora. Intenta de nuevo más tarde.`,
      });
    }
    const { error: errorRegistro } = await deps.admin.from("uso_ia").insert({ user_id: usuario.id });
    if (errorRegistro) {
      console.error("No se pudo registrar uso_ia:", errorRegistro.message);
      return responderJson(req, 500, { error: "interno" });
    }
    const restantes = Math.max(0, LIMITE_POR_HORA - ((count ?? 0) + 1));

    let clasificacion: Record<string, unknown>;
    try {
      const respuesta = await llamarGemini(deps, claveGemini, {
        contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: imagen } }] }],
        generationConfig: { response_mime_type: "application/json", temperature: 0.2 },
      });
      const partes = respuesta?.candidates?.[0]?.content?.parts ?? [];
      clasificacion = JSON.parse(partes.map((p: { text?: string }) => p.text ?? "").join(""));
    } catch (error) {
      console.error("Fallo la IA:", error instanceof Error ? error.message : error);
      return responderJson(req, 502, { error: "ia_no_disponible" });
    }

    const animal = ["gato", "perro", "otro"].includes(String(clasificacion?.animal))
      ? String(clasificacion.animal)
      : "otro";
    if (animal === "otro") {
      return responderJson(req, 200, { animal, raza_estimada: "", patron_o_subtipo: "", detalles: null, restantes });
    }

    const razaEstimada = texto(clasificacion.raza_estimada, 80);
    const patron = texto(clasificacion.patron_o_subtipo, 80);
    const idRaza = /^[a-z0-9_-]{1,40}$/i.test(String(clasificacion.api_breed_id ?? ""))
      ? String(clasificacion.api_breed_id)
      : "";
    const objetivo = animal === "perro" && clasificacion.api_target === "local" ? "local" : "api";

    const detalles = await buscarDetalles(deps, animal, idRaza, razaEstimada, objetivo);
    return responderJson(req, 200, {
      animal,
      raza_estimada: razaEstimada,
      patron_o_subtipo: patron,
      detalles,
      restantes,
    });
  };
}
