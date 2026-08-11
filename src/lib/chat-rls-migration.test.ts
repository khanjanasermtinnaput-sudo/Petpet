import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260811202020_vet_ai_chat_and_breeds.sql"),
  "utf8",
);

describe("VET AI migration RLS contract", () => {
  it("enables RLS and scopes conversations to auth.uid()", () => {
    expect(migration).toContain("alter table public.chat_conversations enable row level security");
    expect(migration).toContain("using ((select auth.uid()) = user_id)");
    expect(migration).toContain("with check ((select auth.uid()) = user_id)");
  });

  it("authorizes messages through their parent conversation, not a public policy", () => {
    expect(migration).toContain("alter table public.chat_messages enable row level security");
    expect(migration).toContain("c.id = conversation_id and c.user_id = (select auth.uid())");
    expect(migration).not.toContain("chat_messages_select_all");
    expect(migration).not.toContain("chat_conversations_select_all");
  });
});
