import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260812174831_vet_ai_image_understanding.sql"),
  "utf8",
);

describe("VET AI image migration", () => {
  it("adds optional image reference fields without changing existing message fields", () => {
    expect(migration).toContain("add column if not exists image_path text");
    expect(migration).toContain("add column if not exists image_mime_type text");
  });

  it("creates a private one-megabyte image bucket", () => {
    expect(migration).toContain("'vet-chat-images'");
    expect(migration).toContain("false,");
    expect(migration).toContain("1048576");
  });

  it("scopes storage access to auth.uid and an owned conversation", () => {
    expect(migration).toContain("(storage.foldername(name))[1] = (select auth.uid()::text)");
    expect(migration).toContain("c.user_id = (select auth.uid())");
    expect(migration).toContain("owner_id = (select auth.uid()::text)");
  });
});
