import type { StorageProvider } from "./types";
import { LocalStorageProvider } from "./local";
import { SupabaseStorageProvider } from "./supabase";

let cached: StorageProvider | null = null;

/**
 * Resolve the active StorageProvider. Defaults to localStorage; switches to
 * Supabase only when explicitly configured via env vars. Falls back to local
 * if Supabase is requested but misconfigured, so the app never hard-fails.
 */
export function getStorageProvider(): StorageProvider {
  if (cached) return cached;

  const provider = process.env.NEXT_PUBLIC_STORAGE_PROVIDER;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (provider === "supabase" && url && anonKey) {
    cached = new SupabaseStorageProvider(url, anonKey);
  } else {
    cached = new LocalStorageProvider();
  }
  return cached;
}

export type { StorageProvider } from "./types";
