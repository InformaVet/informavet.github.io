// Inicio de sesión con RUT.
// El navegador nunca consulta la tabla perfiles: este endpoint resuelve RUT -> correo en el
// servidor, valida la contraseña y devuelve solo la sesión. Si el RUT no existe responde
// exactamente igual que con una contraseña incorrecta (no revela qué RUT están registrados).

import { leerJson, normalizarRut, responderJson, responderOpciones } from "../_shared/comun.ts";

const CREDENCIALES_INVALIDAS = { error: "Invalid login credentials" };

interface Dependencias {
  // deno-lint-ignore no-explicit-any
  admin: { from: (tabla: string) => any };
  iniciarSesion: (
    correo: string,
    password: string,
    // deno-lint-ignore no-explicit-any
  ) => Promise<{ data: any; error: { message: string } | null }>;
}

export function crearManejador(deps: Dependencias) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return responderOpciones(req);
    if (req.method !== "POST") return responderJson(req, 405, { error: "metodo_no_permitido" });

    const cuerpo = await leerJson(req);
    const rut = normalizarRut(cuerpo?.rut);
    const password = cuerpo?.password;
    if (typeof password !== "string" || password.length === 0 || password.length > 200) {
      return responderJson(req, 400, CREDENCIALES_INVALIDAS);
    }
    if (!rut) return responderJson(req, 400, CREDENCIALES_INVALIDAS);

    const { data: perfil, error: errorPerfil } = await deps.admin
      .from("perfiles")
      .select("email")
      .eq("rut", rut)
      .maybeSingle();
    if (errorPerfil) {
      console.error("No se pudo buscar el perfil:", errorPerfil.message);
      return responderJson(req, 500, { error: "interno" });
    }
    if (!perfil?.email) return responderJson(req, 400, CREDENCIALES_INVALIDAS);

    const { data, error } = await deps.iniciarSesion(perfil.email, password);
    if (error || !data?.session) {
      return responderJson(req, 400, { error: error?.message ?? CREDENCIALES_INVALIDAS.error });
    }

    return responderJson(req, 200, {
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
    });
  };
}
