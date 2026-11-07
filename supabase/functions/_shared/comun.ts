// Utilidades compartidas por las Edge Functions de InformaVet.
// Solo APIs estándar (Request/Response/fetch): así la lógica se puede probar fuera de Deno.

const ORIGENES = ["https://informavet.github.io"];
const ORIGEN_LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function origenPermitido(origen: string | null): string | null {
  if (!origen) return null;
  return ORIGENES.includes(origen) || ORIGEN_LOCAL.test(origen) ? origen : null;
}

export function cabecerasCors(req: Request): Record<string, string> {
  const cabeceras: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  const origen = origenPermitido(req.headers.get("origin"));
  if (origen) cabeceras["Access-Control-Allow-Origin"] = origen;
  return cabeceras;
}

export function responderJson(req: Request, estado: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...cabecerasCors(req), "Content-Type": "application/json; charset=utf-8" },
  });
}

export function responderOpciones(req: Request): Response {
  return new Response(null, { status: 204, headers: cabecerasCors(req) });
}

/** Extrae el token "Bearer xxx" de la cabecera Authorization. */
export function tokenDeSolicitud(req: Request): string | null {
  const cabecera = req.headers.get("authorization") ?? "";
  const partes = cabecera.split(" ");
  if (partes.length !== 2 || partes[0].toLowerCase() !== "bearer" || !partes[1]) return null;
  return partes[1];
}

const FORMATO_RUT = /^[0-9]{1,2}\.?[0-9]{3}\.?[0-9]{3}-?[0-9kK]$/;

/** Devuelve el RUT normalizado ("12345678-9") o null si el formato no es válido. */
export function normalizarRut(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const texto = valor.trim();
  if (!FORMATO_RUT.test(texto)) return null;
  const limpio = texto.replace(/\./g, "").replace(/-/g, "").toUpperCase();
  return limpio.slice(0, -1) + "-" + limpio.slice(-1);
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function leerJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const dato = await req.json();
    return dato && typeof dato === "object" && !Array.isArray(dato) ? dato : null;
  } catch {
    return null;
  }
}
