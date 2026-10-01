import { supabase } from "./supabase";

export async function ensureProfile() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) return;

  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        user_id: user.id,
        name: "Ahmet",
      },
      {
        onConflict: "user_id",
      },
    );

  if (error) throw error;

  console.log("✅ Supabase profile hazır:", user.id);
}
