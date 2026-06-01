import type { LayoutProject } from "@/lib/types";

/**
 * StorageProvider abstracts persistence so the app can run with zero backend
 * (localStorage) or, when env vars are set, against Supabase Postgres.
 * Adapters must be safe to call from the client.
 */
export interface StorageProvider {
  readonly name: string;
  list(): Promise<LayoutProject[]>;
  get(id: string): Promise<LayoutProject | null>;
  save(project: LayoutProject): Promise<void>;
  remove(id: string): Promise<void>;
}
