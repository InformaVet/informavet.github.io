// ============================================================
// autenticacion.js — InformaVet
// Funciones de autenticación usando Supabase Auth.
// Requiere que cliente-supabase.js ya haya creado la variable `db`
// y, para el login con RUT, que funciones.js esté cargado.
// ============================================================

// ── Helpers ──────────────────────────────────────────────────

/** Devuelve true si el string parece un RUT chileno (con o sin puntos/guión) */
function esRut(valor) {
    return /^[0-9]{1,2}\.?[0-9]{3}\.?[0-9]{3}-?[0-9kK]$/.test(valor.trim())
}

/** Elimina puntos y deja el guión antes del dígito verificador */
function normalizarRut(rut) {
    const limpio = rut.replace(/\./g, '').replace(/-/g, '').toUpperCase()
    return limpio.slice(0, -1) + '-' + limpio.slice(-1)
}

// ── Registro ─────────────────────────────────────────────────

/**
 * Crea una cuenta nueva en Supabase Auth. El nombre y el RUT viajan como metadatos y
 * un trigger de la base de datos crea la fila en `perfiles` (funciona aunque el correo
 * aún no esté confirmado).
 *
 * @returns {{ data, error }}
 */
async function registrar(nombre, rut, correo, password) {
    const { data, error } = await db.auth.signUp({
        email: correo.trim(),
        password,
        options: {
            data: {
                nombre: nombre.trim(),
                rut: normalizarRut(rut)
            }
        }
    })

    if (error) return { data: null, error }
    return { data, error: null }
}

// ── Login ─────────────────────────────────────────────────────

/**
 * Inicia sesión con correo o RUT + contraseña.
 * - Si el input tiene "@" o no parece RUT → se usa como correo directamente.
 * - Si parece un RUT → la Edge Function `login-rut` resuelve el correo en el servidor
 *   (el navegador nunca ve correos ajenos) y devuelve la sesión.
 *
 * @returns {{ data, error }}
 */
async function iniciarSesion(rutOCorreo, password) {
    const valor = rutOCorreo.trim()

    if (!esRut(valor)) {
        return await db.auth.signInWithPassword({ email: valor, password })
    }

    const { data, error } = await invocarFuncion('login-rut', {
        rut: normalizarRut(valor),
        password
    })

    if (error) {
        const mensaje = error.codigo === 'red'
            ? 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.'
            : error.mensaje
        return { data: null, error: { message: mensaje } }
    }

    return await db.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
    })
}

// ── Cierre de sesión ──────────────────────────────────────────

async function cerrarSesion() {
    const { error } = await db.auth.signOut()
    return { error }
}

// ── Estado de sesión ──────────────────────────────────────────

/** Devuelve el objeto usuario actual, o null si no hay sesión. */
async function obtenerUsuario() {
    const { data: { user } } = await db.auth.getUser()
    return user
}

/** Perfil del usuario actual ({ nombre, rol, activo }) o null. */
async function obtenerPerfil() {
    const usuario = await obtenerUsuario()
    if (!usuario) return null
    const { data } = await db
        .from('perfiles')
        .select('nombre, rol, activo')
        .eq('id', usuario.id)
        .maybeSingle()
    return data
}

/** true si el usuario actual es administrador activo. */
async function esAdmin() {
    const perfil = await obtenerPerfil()
    return !!perfil && perfil.rol === 'admin' && perfil.activo !== false
}

/**
 * Protege una página privada: si no hay sesión redirige al login.
 * Uso:  const usuario = await requiereAuth()
 */
async function requiereAuth(urlLogin = '../paginas/login.html') {
    const usuario = await obtenerUsuario()
    if (!usuario) {
        window.location.href = urlLogin
        return null
    }
    return usuario
}

/**
 * Para páginas de login/registro: si ya hay sesión redirige al inicio
 * para evitar que un usuario logueado vea esas páginas.
 */
async function redirigirSiAutenticado(urlDestino = '../index.html') {
    const usuario = await obtenerUsuario()
    if (usuario) window.location.href = urlDestino
}
