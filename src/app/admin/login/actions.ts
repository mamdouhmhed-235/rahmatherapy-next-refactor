"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

interface SignInAdminResult {
  error?: string;
}

export async function signInAdmin(
  email: string,
  password: string
): Promise<SignInAdminResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      error: "Invalid credentials. Please check your email and password.",
    };
  }

  return {};
}
