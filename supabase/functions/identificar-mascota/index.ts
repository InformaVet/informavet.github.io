import { createClient } from "npm:@supabase/supabase-js@2";
import { crearManejador } from "./manejador.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

Deno.serve(
  crearManejador({
    env: (nombre) => Deno.env.get(nombre),
    admin,
    fetch,
    esperar: (ms) => new Promise((resolver) => setTimeout(resolver, ms)),
    ahora: () => Date.now(),
  }),
);
