#!/usr/bin/env node

import fs from "node:fs";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const TEST_USERS = [
  {
    email: "phase3.admin@example.test",
    password: "Phase3-Test-Admin-2026!",
  },
  {
    email: "phase3.regular@example.test",
    password: "Phase3-Test-Regular-2026!",
  },
  {
    email: "phase3.inactive@example.test",
    password: "Phase3-Test-Inactive-2026!",
  },
];

function loadEnv() {
  const envText = fs.readFileSync(".env", "utf8");
  const env = {};

  for (const line of envText.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    const key = line.slice(0, separatorIndex);
    const rawValue = line.slice(separatorIndex + 1);
    env[key] = rawValue.replace(/^"|"$/g, "");
  }

  return env;
}

function createAdminClient() {
  const env = loadEnv();

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase URL or service role key in .env.");
  }

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

async function findUserByEmail(supabase, email) {
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(`Failed to list auth users: ${error.message}`);
    }

    const user = data.users.find(
      (candidate) =>
        candidate.email?.trim().toLowerCase() === email.toLowerCase()
    );

    if (user) return user;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function ensureUser(supabase, user) {
  const existing = await findUserByEmail(supabase, user.email);
  if (existing) {
    return {
      email: user.email,
      id: existing.id,
      created: false,
    };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: {
      purpose: "implementation_plan3_phase_verification",
    },
  });

  if (error) {
    throw new Error(`Failed to create ${user.email}: ${error.message}`);
  }

  return {
    email: user.email,
    id: data.user.id,
    created: true,
  };
}

async function main() {
  const supabase = createAdminClient();
  const results = [];

  for (const user of TEST_USERS) {
    results.push(await ensureUser(supabase, user));
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
