import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Recursively delete all objects under "<userId>/" in every storage bucket. */
export async function removeUserFiles(admin: AdminClient, userId: string) {
  const { data: buckets } = await admin.storage.listBuckets();
  for (const bucket of buckets ?? []) {
    const queue = [userId];
    while (queue.length) {
      const prefix = queue.shift()!;
      const { data: entries } = await admin.storage.from(bucket.id).list(prefix, { limit: 1000 });
      const files: string[] = [];
      for (const e of entries ?? []) {
        // Folders come back without an id.
        if (e.id === null) queue.push(`${prefix}/${e.name}`);
        else files.push(`${prefix}/${e.name}`);
      }
      if (files.length) await admin.storage.from(bucket.id).remove(files);
    }
  }
}

