// ============================================================
// funciones.js — InformaVet
// Llama a las Edge Functions de Supabase y normaliza los errores.
// Requiere que cliente-supabase.js ya haya creado la variable `db`.
// ============================================================

/**
 * Invoca una Edge Function con la sesión actual (si hay una).
 * Devuelve { data, error }. Si falla, error = { estado, codigo, mensaje }:
 *   - estado: código HTTP (0 si no hubo conexión)
 *   - codigo: el "error" que devuelve la función (ej. "limite", "no_autenticado")
 *   - mensaje: texto legible si la función envió uno
 */
async function invocarFuncion(nombre, cuerpo) {
    const { data, error } = await db.functions.invoke(nombre, { body: cuerpo })
    if (!error) return { data, error: null }

    let estado = 0
    let detalle = null
    if (error.context && typeof error.context.json === 'function') {
        estado = error.context.status
        try { detalle = await error.context.json() } catch (_) { /* respuesta sin JSON */ }
    }

    return {
        data: null,
        error: {
            estado,
            codigo: (detalle && detalle.error) || 'red',
            mensaje: (detalle && (detalle.mensaje || detalle.error || detalle.message)) || error.message
        }
    }
}
