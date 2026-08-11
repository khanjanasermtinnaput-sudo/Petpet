import type { User } from "@supabase/supabase-js";
import { getPet } from "@/lib/active-pet";
import { createClient } from "@/lib/supabase/server";
import { createAuthClient } from "@/lib/supabase/auth-server";
import type { Pet } from "@/lib/types";

export type ChatContext = {
  user: User;
  pet: Pet;
  chatClient: Awaited<ReturnType<typeof createAuthClient>>;
};

export async function getChatContext(): Promise<ChatContext | null> {
  const chatClient = await createAuthClient();
  const { data: { user } } = await chatClient.auth.getUser();
  if (!user) return null;

  const pet = await getPet(await createClient());
  if (!pet) return null;

  return { user, pet, chatClient };
}
