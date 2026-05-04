import { getCloudflareContext } from "@opennextjs/cloudflare";

type CloudflareRuntimeEnv = Record<string, unknown>;

export function getServerEnv(name: string) {
  const processValue = process.env[name];
  if (processValue) return processValue;

  try {
    const cloudflareEnv = getCloudflareContext().env as CloudflareRuntimeEnv;
    const bindingValue = cloudflareEnv[name];
    return typeof bindingValue === "string" ? bindingValue : undefined;
  } catch {
    return undefined;
  }
}
