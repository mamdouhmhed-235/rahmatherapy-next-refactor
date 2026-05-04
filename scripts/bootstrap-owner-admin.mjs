#!/usr/bin/env node

import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const CRITICAL_PERMISSIONS = new Set(["manage_users", "manage_roles"]);
const VALID_GENDERS = new Set(["male", "female"]);

function readArgs(argv) {
  const args = {
    allowExistingCriticalAdmin: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--allow-existing-critical-admin") {
      args.allowExistingCriticalAdmin = true;
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

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function requiredString(args, key, label = key) {
  const value = args[key]?.trim();

  if (!value) {
    throw new Error(`Missing required --${label}`);
  }

  return value;
}

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function findAuthUserByEmail(supabase, email) {
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
      (candidate) => normalizeEmail(candidate.email ?? "") === email
    );

    if (user) return user;
    if (data.users.length < perPage) return null;

    page += 1;
  }
}

async function getRole(supabase, roleId, roleName) {
  let query = supabase.from("roles").select("id, name");

  if (roleId) {
    query = query.eq("id", roleId);
  } else {
    query = query.ilike("name", roleName);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(`Failed to load role: ${error.message}`);
  }

  if (!data) {
    throw new Error(`No role found for ${roleId ? `id ${roleId}` : roleName}.`);
  }

  return data;
}

async function getCriticalRoleIds(supabase, roleIds) {
  if (roleIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from("role_permissions")
    .select("role_id, permissions(name)")
    .in("role_id", roleIds);

  if (error) {
    throw new Error(`Failed to load role permissions: ${error.message}`);
  }

  const rolePermissions = new Map();

  for (const row of data ?? []) {
    const permissionName = row.permissions?.name;
    if (!permissionName) continue;

    const permissions = rolePermissions.get(row.role_id) ?? new Set();
    permissions.add(permissionName);
    rolePermissions.set(row.role_id, permissions);
  }

  return new Set(
    [...rolePermissions.entries()]
      .filter(([, permissions]) =>
        [...CRITICAL_PERMISSIONS].every((permission) =>
          permissions.has(permission)
        )
      )
      .map(([roleId]) => roleId)
  );
}

async function assertNoActiveCriticalAdmin(supabase, allowExistingCriticalAdmin) {
  const { data, error } = await supabase
    .from("staff_profiles")
    .select("id, email, role_id")
    .eq("active", true);

  if (error) {
    throw new Error(`Failed to inspect staff profiles: ${error.message}`);
  }

  const roleIds = [...new Set((data ?? []).map((profile) => profile.role_id))];
  const criticalRoleIds = await getCriticalRoleIds(supabase, roleIds);
  const activeCriticalAdmins = (data ?? []).filter((profile) =>
    criticalRoleIds.has(profile.role_id)
  );

  if (activeCriticalAdmins.length > 0 && !allowExistingCriticalAdmin) {
    throw new Error(
      [
        "Refusing to bootstrap because an active critical admin already exists.",
        "Use --allow-existing-critical-admin only after a reviewed production decision.",
      ].join(" ")
    );
  }
}

async function assertRoleIsCritical(supabase, role) {
  const criticalRoleIds = await getCriticalRoleIds(supabase, [role.id]);

  if (!criticalRoleIds.has(role.id)) {
    throw new Error(
      `Role "${role.name}" does not include manage_users and manage_roles.`
    );
  }
}

async function assertAuthUserIsUnlinked(supabase, authUserId) {
  const { data, error } = await supabase
    .from("staff_profiles")
    .select("id, email")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check linked staff profile: ${error.message}`);
  }

  if (data) {
    throw new Error(
      `Auth user is already linked to staff profile ${data.id} (${data.email}).`
    );
  }
}

async function bootstrap() {
  const args = readArgs(process.argv);
  const email = normalizeEmail(requiredString(args, "email"));
  const fullName = requiredString(args, "full-name", "full-name");
  const gender = requiredString(args, "gender").toLowerCase();
  const roleName = args.role?.trim();
  const roleId = args["role-id"]?.trim();

  if (!VALID_GENDERS.has(gender)) {
    throw new Error("--gender must be either male or female.");
  }

  if (!roleName && !roleId) {
    throw new Error("Provide either --role or --role-id.");
  }

  if (roleName && roleId) {
    throw new Error("Provide only one of --role or --role-id.");
  }

  const supabase = createAdminClient();
  const authUser = await findAuthUserByEmail(supabase, email);

  if (!authUser) {
    throw new Error(
      `No existing Supabase Auth user found for ${email}. Create the Auth user first.`
    );
  }

  const role = await getRole(supabase, roleId, roleName);

  await assertRoleIsCritical(supabase, role);
  await assertNoActiveCriticalAdmin(
    supabase,
    args.allowExistingCriticalAdmin
  );
  await assertAuthUserIsUnlinked(supabase, authUser.id);

  const { data: staffProfile, error: insertError } = await supabase
    .from("staff_profiles")
    .insert({
      auth_user_id: authUser.id,
      name: fullName,
      email,
      role_id: role.id,
      gender,
      active: true,
      can_take_bookings: false,
      availability_mode: "use_global",
    })
    .select("id, email, name, role_id, gender, active, can_take_bookings, availability_mode")
    .single();

  if (insertError) {
    throw new Error(`Failed to create staff profile: ${insertError.message}`);
  }

  const { error: auditError } = await supabase.from("audit_logs").insert({
    actor_staff_id: staffProfile.id,
    action_type: "production_owner_admin_bootstrapped",
    target_type: "staff_profiles",
    target_id: staffProfile.id,
    after_state: {
      id: staffProfile.id,
      email: staffProfile.email,
      name: staffProfile.name,
      role_id: staffProfile.role_id,
      role_name: role.name,
      gender: staffProfile.gender,
      active: staffProfile.active,
      can_take_bookings: staffProfile.can_take_bookings,
      availability_mode: staffProfile.availability_mode,
    },
  });

  if (auditError) {
    throw new Error(
      `Staff profile was created, but audit log insert failed: ${auditError.message}`
    );
  }

  console.log(
    `Bootstrapped ${role.name} staff profile ${staffProfile.id} for ${email}.`
  );
}

bootstrap().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
