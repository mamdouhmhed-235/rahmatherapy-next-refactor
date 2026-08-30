"use server";

import { headers } from "next/headers";

import {
  ADMIN_LOGIN_RATE_LIMIT,
  RATE_LIMITED_LOGIN_MESSAGE,
  checkRateLimitForIp,
} from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface SignInAdminResult {
  error?: string;
}

export async function signInAdmin(
  email: string,
  password: string
): Promise<SignInAdminResult> {
  // ⛔ Before this, the admin sign-in had NO brake of any kind: no cap on
  // attempts, no lock-out, and no record that anyone had tried. A guesser got
  // unlimited attempts at accounts that can read every client's name, address
  // and health notes.
  //
  // ⚠️ Supabase's own auth rate limiting does not help here. This runs
  // server-side on Cloudflare, so Supabase sees the Worker's address rather
  // than the visitor's — every attempt in the world looks like one client.
  //
  // ⛔ `CF-Connecting-IP` specifically, never `X-Forwarded-For`: the latter is
  // client-supplied, so a guesser could reset their own budget on every attempt
  // and the limit would exist only for honest users.
  const requestHeaders = await headers();
  const allowed = await checkRateLimitForIp(
    requestHeaders.get("CF-Connecting-IP"),
    "admin-login",
    ADMIN_LOGIN_RATE_LIMIT
  );

  if (!allowed) {
    // ⚠️ Deliberately NOT the same sentence as a bad password. A rejected
    // attempt has to be distinguishable from a wrong password, or a locked-out
    // staff member keeps retrying a password that was right all along.
    return { error: RATE_LIMITED_LOGIN_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // ⚠️ The message stays deliberately vague about WHICH half was wrong, so it
    // cannot be used to confirm that an email address belongs to a staff member.
    return {
      error: "Invalid credentials. Please check your email and password.",
    };
  }

  return {};
}
