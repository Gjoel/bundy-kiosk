// src/supabase.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const org = import.meta.env.VITE_ORG_ID || "wslr";

export const sb = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { "x-org-id": org } },
});
