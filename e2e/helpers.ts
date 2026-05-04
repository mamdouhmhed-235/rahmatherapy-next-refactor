import fs from "node:fs";
import { expect, type Page } from "@playwright/test";
import { createBrowserClient } from "@supabase/ssr";

export interface E2ERoleCredentials {
  email: string;
  password: string;
}

export function hasBaseUrl() {
  return Boolean(process.env.E2E_BASE_URL);
}

export function getCredentials(prefix: string): E2ERoleCredentials | null {
  const email = process.env[`E2E_${prefix}_EMAIL`];
  const password = process.env[`E2E_${prefix}_PASSWORD`];

  return email && password ? { email, password } : null;
}

export function requireCredentials(prefixes: string[]) {
  return prefixes.every((prefix) => getCredentials(prefix));
}

export async function loginAs(page: Page, credentials: E2ERoleCredentials) {
  const supabaseUrl = getEnvValue("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = getEnvValue("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const cookiesToSet: AuthCookie[] = [];
  const cookieJar: AuthCookie[] = [];

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase URL or anon key for E2E authentication.");
  }

  const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    isSingleton: false,
    cookies: {
      getAll() {
        return cookieJar;
      },
      setAll(cookies) {
        for (const cookie of cookies) {
          const existingIndex = cookieJar.findIndex((item) => item.name === cookie.name);
          if (existingIndex >= 0) {
            cookieJar[existingIndex] = cookie;
          } else {
            cookieJar.push(cookie);
          }
          cookiesToSet.push(cookie);
        }
      },
    },
  });

  const { error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  if (error) {
    throw new Error(`E2E authentication failed for ${credentials.email}: ${error.message}`);
  }

  const origin = new URL(process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000").origin;
  await page.context().addCookies(
    cookiesToSet
      .filter((cookie) => cookie.value)
      .map((cookie) => {
        const browserCookie = {
          name: cookie.name,
          value: cookie.value,
          url: origin,
          httpOnly: cookie.options?.httpOnly ?? false,
          secure: cookie.options?.secure ?? false,
          sameSite: normalizeSameSite(cookie.options?.sameSite),
        };

        return typeof cookie.options?.maxAge === "number"
          ? {
              ...browserCookie,
              expires: Math.floor(Date.now() / 1000) + cookie.options.maxAge,
            }
          : browserCookie;
      })
  );
}

export async function openAdminNavigationIfNeeded(page: Page) {
  const visibleNavigation = page.locator('nav[aria-label="Admin navigation"]:visible');
  if ((await visibleNavigation.count()) > 0) return;

  const drawerButton = page.getByRole("button", { name: /open admin navigation/i });
  if (await drawerButton.isVisible().catch(() => false)) {
    await expect(drawerButton).toBeEnabled();
    await drawerButton.click();
    await expect(visibleNavigation).toBeVisible();
  }
}

export async function expectVisibleNavigation(page: Page, labels: string[]) {
  await openAdminNavigationIfNeeded(page);
  const navigation = page.locator('nav[aria-label="Admin navigation"]:visible');

  for (const label of labels) {
    await expect(navigation.getByRole("link", { name: label })).toBeVisible();
  }
}

export async function expectHiddenNavigation(page: Page, labels: string[]) {
  await openAdminNavigationIfNeeded(page);
  const navigation = page.locator('nav[aria-label="Admin navigation"]:visible');

  for (const label of labels) {
    await expect(navigation.getByRole("link", { name: label })).toHaveCount(0);
  }
}

type AuthCookie = {
  name: string;
  value: string;
  options?: {
    path?: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: string | boolean;
    maxAge?: number;
  };
};

function getEnvValue(name: string) {
  if (process.env[name]) return process.env[name];

  const envText = fs.existsSync(".env") ? fs.readFileSync(".env", "utf8") : "";
  for (const line of envText.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const separatorIndex = line.indexOf("=");
    const key = line.slice(0, separatorIndex);
    if (key !== name) continue;
    return line.slice(separatorIndex + 1).replace(/^"|"$/g, "");
  }

  return undefined;
}

function normalizeSameSite(value: string | boolean | undefined): "Strict" | "Lax" | "None" {
  if (typeof value !== "string") return "Lax";
  if (value.toLowerCase() === "strict") return "Strict";
  if (value.toLowerCase() === "none") return "None";
  return "Lax";
}
