#!/usr/bin/env node

import fs from "node:fs";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const CONFIRMATION = "RESET_LIVE_USER_DATA";

function readEnvFile() {
  if (!fs.existsSync(".env")) return {};

  const env = {};
  const envText = fs.readFileSync(".env", "utf8");

  for (const line of envText.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const separatorIndex = line.indexOf("=");
    const key = line.slice(0, separatorIndex);
    const rawValue = line.slice(separatorIndex + 1);
    env[key] = rawValue.replace(/^"|"$/g, "");
  }

  return env;
}

function readArgs(argv) {
  const args = { dryRun: false };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }

    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    const key = arg.slice(2);
    const value = argv[index + 1];

    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }

    args[key] = value;
    index += 1;
  }

  return args;
}

function requiredString(args, key) {
  const value = String(args[key] ?? "").trim();
  if (!value) throw new Error(`Missing required --${key}`);
  return value;
}

function createAdminClient(env) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return {
    url,
    client: createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }),
  };
}

function assertProjectRef(url, expectedRef) {
  const actualRef = new URL(url).hostname.split(".")[0];
  if (actualRef !== expectedRef) {
    throw new Error(
      `Refusing to run against project ${actualRef}; expected ${expectedRef}.`
    );
  }
}

async function listAllUsers(supabase) {
  const users = [];
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

    users.push(...data.users);
    if (data.users.length < perPage) return users;

    page += 1;
  }
}

async function main() {
  const args = readArgs(process.argv);
  const projectRef = requiredString(args, "project-ref");
  const ownerEmail = requiredString(args, "email").toLowerCase();
  const ownerPassword = requiredString(args, "password");
  const env = readEnvFile();
  const { url, client } = createAdminClient(env);

  assertProjectRef(url, projectRef);

  const users = await listAllUsers(client);

  if (args.dryRun) {
    console.log(
      JSON.stringify(
        {
          projectRef,
          dryRun: true,
          currentUsers: users.map((user) => ({
            id: user.id,
            email: user.email,
          })),
          ownerEmail,
        },
        null,
        2
      )
    );
    return;
  }

  if (args.confirm !== CONFIRMATION) {
    throw new Error(`Refusing to mutate Auth without --confirm ${CONFIRMATION}.`);
  }

  const deletedUsers = [];
  for (const user of users) {
    const { error } = await client.auth.admin.deleteUser(user.id);
    if (error) {
      throw new Error(`Failed to delete ${user.email ?? user.id}: ${error.message}`);
    }
    deletedUsers.push({ id: user.id, email: user.email });
  }

  const { data, error } = await client.auth.admin.createUser({
    email: ownerEmail,
    password: ownerPassword,
    email_confirm: true,
    app_metadata: {
      bootstrap_owner: true,
    },
  });

  if (error || !data.user) {
    throw new Error(`Failed to create owner auth user: ${error?.message ?? "missing user"}`);
  }

  console.log(
    JSON.stringify(
      {
        projectRef,
        deletedUsers,
        ownerUser: {
          id: data.user.id,
          email: data.user.email,
        },
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
