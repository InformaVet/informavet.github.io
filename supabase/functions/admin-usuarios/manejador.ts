// Acciones de administración sobre cuentas: desactivar, reactivar y eliminar.
// Usan la service_role (que jamás debe salir del servidor), por eso viven aquí y no en el
// navegador. Antes de actuar se verifica que quien llama sea admin activo leyendo su rol
// en la tabla perfiles. Cada acción queda registrada en auditoria_admin.

import {
  leerJson,
  responderJson,
  responderOpciones,
  tokenDeSolicitud,
  UUID,
} from "../_shared/comun.ts";

const ACCIONES = ["desactivar", "reactivar", "eliminar"];
const BUCKET_FOTOS = "fotos-mascotas";
const CIEN_ANOS = "876000h";

interface ClienteAdmin {
  // deno-lint-ignore no-explicit-any
  auth: { getUser: (token: string) => Promise<any>; admin: any };
  // deno-lint-ignore no-explicit-any
  from: (tabla: string) => any;
  // deno-lint-ignore no-explicit-any
  storage: { from: (bucket: string) => any };
}

export function crearManejador(deps: { admin: ClienteAdmin }) {
  const { admin } = deps;

  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return responderOpciones(req);
    if (req.method !== "POST") return responderJson(req, 405, { error: "metodo_no_permitido" });

    const token = tokenDeSolicitud(req);
    if (!token) return responderJson(req, 401, { error: "no_autenticado" });
    const { data: sesion, error: errorSesion } = await admin.auth.getUser(token);
    const quien = sesion?.user;
    if (errorSesion || !quien) return responderJson(req, 401, { error: "no_autenticado" });

    const { data: yo } = await admin
      .from("perfiles")
      .select("rol, activo, email")
      .eq("id", quien.id)
      .maybeSingle();
    if (!yo || yo.rol !== "admin" || yo.activo === false) {
      return responderJson(req, 403, { error: "sin_permiso" });
    }

    const cuerpo = await leerJson(req);
    const accion = cuerpo?.accion;
    const usuarioId = cuerpo?.usuario_id;
    if (typeof accion !== "string" || !ACCIONES.includes(accion)) {
      return responderJson(req, 400, { error: "accion_invalida" });
    }
    if (typeof usuarioId !== "string" || !UUID.test(usuarioId)) {
      return responderJson(req, 400, { error: "usuario_invalido" });
    }
    if (usuarioId === quien.id) return responderJson(req, 400, { error: "no_sobre_ti_mismo" });

    const { data: objetivo } = await admin
      .from("perfiles")
      .select("id, email, rol")
      .eq("id", usuarioId)
      .maybeSingle();
    if (!objetivo) return responderJson(req, 404, { error: "usuario_no_encontrado" });
    if (objetivo.rol === "admin") return responderJson(req, 403, { error: "objetivo_es_admin" });

    const fallo = (paso: string, detalle: unknown) => {
      console.error(`admin-usuarios: falló "${paso}":`, detalle);
      return responderJson(req, 500, { error: "interno", paso });
    };

    if (accion === "desactivar" || accion === "reactivar") {
      const desactivar = accion === "desactivar";
      const { error: errorAuth } = await admin.auth.admin.updateUserById(usuarioId, {
        ban_duration: desactivar ? CIEN_ANOS : "none",
      });
      if (errorAuth) return fallo("auth", errorAuth.message);
      const { error: errorPerfil } = await admin
        .from("perfiles")
        .update({ activo: !desactivar })
        .eq("id", usuarioId);
      if (errorPerfil) return fallo("perfil", errorPerfil.message);
    } else {
      // Las fotos están en Storage y no se borran solas al eliminar la cuenta.
      const almacen = admin.storage.from(BUCKET_FOTOS);
      const { data: archivos, error: errorListado } = await almacen.list(usuarioId, { limit: 1000 });
      if (errorListado) return fallo("fotos", errorListado.message);
      if (archivos?.length) {
        const { error: errorBorrado } = await almacen.remove(
          archivos.map((a: { name: string }) => `${usuarioId}/${a.name}`),
        );
        if (errorBorrado) return fallo("fotos", errorBorrado.message);
      }
      const { error: errorPerfil } = await admin.from("perfiles").delete().eq("id", usuarioId);
      if (errorPerfil) return fallo("perfil", errorPerfil.message);
      // Borra también mascotas e historial (ON DELETE CASCADE).
      const { error: errorAuth } = await admin.auth.admin.deleteUser(usuarioId);
      if (errorAuth) return fallo("auth", errorAuth.message);
    }

    const { error: errorAuditoria } = await admin.from("auditoria_admin").insert({
      admin_id: quien.id,
      admin_email: yo.email ?? quien.email ?? null,
      accion,
      objetivo_id: usuarioId,
      objetivo_email: objetivo.email ?? null,
    });
    if (errorAuditoria) console.error("No se pudo registrar la auditoría:", errorAuditoria.message);

    return responderJson(req, 200, { ok: true, accion });
  };
}
