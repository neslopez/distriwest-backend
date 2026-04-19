import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// 👇 FORZAMOS lectura correcta del .env
dotenv.config({ path: "./backend/.env" });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export { supabase };