import { createClient } from "npm:@supabase/supabase-js@2";
import { crearManejador } from "./manejador.ts";

const sinSesion = { auth: { persistSession: false, autoRefreshToken: false } };

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  sinSesion,
);

const publico = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!,
  sinSesion,
);

Deno.serve(
  crearManejador({
    admin,
    iniciarSesion: (correo, password) => publico.auth.signInWithPassword({ email: correo, password }),
  }),
);
