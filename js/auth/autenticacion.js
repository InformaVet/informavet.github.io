// ============================================================
// autenticacion.js — InformaVet
// Funciones de autenticación usando Supabase Auth.
// Requiere que cliente-supabase.js ya haya creado la variable `db`.
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
 * Crea una cuenta nueva en Supabase Auth y guarda nombre/rut
 * en la tabla `perfiles` para permitir login con RUT.
 *
 * @returns {{ data, error }}
 */
async function registrar(nombre, rut, correo, password) {
    const rutNormalizado = normalizarRut(rut)

    // 1. Crear usuario en Supabase Auth
    const { data, error } = await db.auth.signUp({
        email: correo.trim(),
        password,
        options: {
            data: {
                nombre: nombre.trim(),
                rut: rutNormalizado
            }
        }
    })

    if (error) return { data: null, error }

    // 2. Guardar en tabla `perfiles` para búsqueda por RUT
    //    Si la tabla no existe, el error se ignora (no bloquea el flujo).
    if (data?.user) {
        await db.from('perfiles').upsert({
            id:     data.user.id,
            nombre: nombre.trim(),
            rut:    rutNormalizado,
            email:  correo.trim()
        }, { onConflict: 'id' })
    }

    return { data, error: null }
}

// ── Login ─────────────────────────────────────────────────────

/**
 * Inicia sesión con correo o RUT + contraseña.
 * - Si el input tiene "@"  → se usa como email directamente.
 * - Si parece un RUT       → busca el email en la tabla `perfiles`.
 *
 * @returns {{ data, error }}
 */
async function iniciarSesion(rutOCorreo, password) {
    let email = rutOCorreo.trim()

    if (esRut(email)) {
        const rut = normalizarRut(email)

        const { data: perfil, error: errPerfil } = await db
            .from('perfiles')
            .select('email')
            .eq('rut', rut)
            .single()

        if (errPerfil || !perfil) {
            return {
                data: null,
                error: { message: 'No se encontró ninguna cuenta con ese RUT. Intenta con tu correo electrónico.' }
            }
        }

        email = perfil.email
    }

    const { data, error } = await db.auth.signInWithPassword({ email, password })
    return { data, error }
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
