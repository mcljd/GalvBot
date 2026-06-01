import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { LayoutProject } from "@/lib/types";
import type { StorageProvider } from "./types";

/**
 * Optional Supabase-backed persistence. Enabled only when
 * NEXT_PUBLIC_STORAGE_PROVIDER=supabase and the URL/anon key are set.
 *
 * Expected table (see README for SQL):
 *   create table layout_projects (
 *     id text primary key,
 *     name text not null,
 *     data jsonb not null,
 *     updated_at timestamptz not null default now()
 *   );
 */
export class SupabaseStorageProvider implements StorageProvider {
  readonly name = "supabase";
  private client: SupabaseClient;
  private table = "layout_projects";

  constructor(url: string, anonKey: string) {
    this.client = createClient(url, anonKey);
  }

  async list(): Promise<LayoutProject[]> {
    const { data, error } = await this.client
      .from(this.table)
      .select("data")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => row.data as LayoutProject);
  }

  async get(id: string): Promise<LayoutProject | null> {
    const { data, error } = await this.client
      .from(this.table)
      .select("data")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data?.data as LayoutProject) ?? null;
  }

  async save(project: LayoutProject): Promise<void> {
    const { error } = await this.client.from(this.table).upsert({
      id: project.id,
      name: project.name,
      data: project,
      updated_at: project.updatedAt,
    });
    if (error) throw error;
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client.from(this.table).delete().eq("id", id);
    if (error) throw error;
  }
}
