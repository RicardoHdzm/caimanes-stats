// Credenciales del proyecto de Supabase — se llenan UNA VEZ después de crear
// el proyecto (ver README.md, sección "Cuentas de jugador (Supabase)").
//
// No son secretos: la "anon key" está pensada para ir del lado del cliente,
// visible para cualquiera que abra el sitio — la protección real la da
// Postgres con Row Level Security (ver supabase/schema.sql), no que esta
// llave esté escondida.
//
// Project Settings → API, en el panel de Supabase:
//   SUPABASE_URL      = "Project URL"       (ej. "https://xxxxx.supabase.co")
//   SUPABASE_ANON_KEY = "anon public" key
export const SUPABASE_URL = "https://qxyksowjjwknyohnixzw.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4eWtzb3dqandrbnlvaG5peHp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NTM4NTQsImV4cCI6MjEwNDAyOTg1NH0.QOjYf-3q3-wF-s6k-fAsAHhkCx4QhobHaJ0W0YcRAko";

// Mientras no se llenen los valores de arriba, auth.js no intenta conectarse
// (evita un error confuso de red en cuanto abras el sitio antes de terminar
// la Fase 0 del proyecto).
export const SUPABASE_CONFIGURED = !SUPABASE_URL.includes("TU-PROYECTO");
