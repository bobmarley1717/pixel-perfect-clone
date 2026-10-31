import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Null when the env vars are missing, so the site still works without cloud saving.
export const supabase = url && anonKey ? createClient(url, anonKey) : null;

export type SavedComposition = { id: string; created_at: string; prompt: string; title: string; composition: unknown };
export type SavedBiome = { id: string; name: string; sounds: string[] };
