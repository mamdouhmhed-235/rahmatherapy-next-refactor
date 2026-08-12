import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";

/**
 * Layer 3 of the ITEM 7 admin-contrast programme
 * (redesign/plans/POST-BAND-C-FOLLOWUP-plan.md §7.9(b)) — helpers for the
 * live Playwright sweep in `e2e/admin-contrast.spec.ts`.
 *
 * No function in this file ever reads, logs, or reports a credential value.
 * Route/role identifiers only.
 */

export const THEMES = ["dark", "light"] as const;
export type AdminTheme = (typeof THEMES)[number];

interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface ContrastFinding {
  ratio: number;
  sample: string;
  selector: string;
  fg: string;
  bg: string;
  fontSize: number;
  fontWeight: number;
  isLarge: boolean;
  threshold: number;
}

export interface ContrastAuditResult {
  nodesChecked: number;
  minRatio: number | null;
  failures: ContrastFinding[];
}

export interface ThemeAudit extends ContrastAuditResult {
  mechanism: "theme-root" | "html-fallback";
}

export type RouteOutcome = "audited" | "redirected" | "denied-inline" | "unreachable";

export interface RouteEntry {
  path: string;
  kind: "static" | "dynamic";
  outcome: RouteOutcome;
  resolvedUrl?: string;
  landedUrl?: string;
  reason?: string;
  themes: Partial<Record<AdminTheme, ThemeAudit>>;
}

export interface RoleRunResult {
  role: string;
  entries: RouteEntry[];
}

/**
 * The 29 role-loop route templates `sweepAdminRoutes` knows how to visit
 * (21 static minus login/password-reset, plus 10 dynamic) — must be kept in
 * sync with the `want("...")` call sites below (same disclosure as this
 * codebase's other guard tests, e.g. C-17's import guard: this is a literal
 * list, not derived, so an added route needs both updated together).
 * Exported so `resolveRouteFilter` can validate CONTRAST_ROUTES against it.
 */
export const ADMIN_CONTRAST_ROUTE_TEMPLATES: readonly string[] = [
  "/admin/dashboard",
  "/admin/bookings",
  "/admin/bookings/new",
  "/admin/bookings/[bookingId]",
  "/admin/bookings/series/[templateId]",
  "/admin/clients",
  "/admin/clients/new",
  "/admin/clients/[clientId]",
  "/admin/clients/[clientId]/edit",
  "/admin/enquiries",
  "/admin/calendar",
  "/admin/staff",
  "/admin/staff/[staffId]",
  "/admin/staff/[staffId]/availability",
  "/admin/staff/[staffId]/performance",
  "/admin/availability",
  "/admin/services",
  "/admin/settings",
  "/admin/operations",
  "/admin/emails",
  "/admin/emails/templates/[templateId]",
  "/admin/roles",
  "/admin/roles/[roleId]",
  "/admin/privacy",
  "/admin/account-password-requests",
  "/admin/audit",
  "/admin/reports",
  "/admin/me",
  "/admin/password-reset/[token]",
];

export interface RouteFilterResolution {
  matched: Set<string>;
  unmatched: string[];
}

/**
 * Resolves raw CONTRAST_ROUTES entries against ADMIN_CONTRAST_ROUTE_TEMPLATES.
 *
 * Handles a real, reproduced environment artifact: on Git Bash/MSYS
 * (Windows), a bare leading-slash argument like `/admin/dashboard` gets
 * silently rewritten to a Windows path anchored at the Git install root
 * (e.g. `C:/Program Files/Git/admin/dashboard`) before Node ever sees it —
 * confirmed via `[DEBUG] routeFilter= [ 'C:/Program Files/Git/admin/dashboard' ]`
 * when reproducing the dropped-dashboard defect. The original route survives
 * intact as a SUFFIX of the mangled string, so a suffix match recovers it
 * without needing the caller to change shells or quote differently.
 *
 * Anything that matches neither exactly nor by suffix is reported in
 * `unmatched` so the caller can fail loudly instead of silently sweeping
 * nothing — a filter value that matches no known route must be a hard error,
 * never a quiet no-op.
 */
export function resolveRouteFilter(rawEntries: string[]): RouteFilterResolution {
  const matched = new Set<string>();
  const unmatched: string[] = [];

  for (const raw of rawEntries) {
    if (ADMIN_CONTRAST_ROUTE_TEMPLATES.includes(raw)) {
      matched.add(raw);
      continue;
    }
    const suffixMatches = ADMIN_CONTRAST_ROUTE_TEMPLATES.filter((route) => raw.endsWith(route));
    if (suffixMatches.length > 0) {
      // Longest match wins — templates are distinct enough that this only
      // matters as a tie-breaker, never a false positive in practice.
      const best = suffixMatches.reduce((a, b) => (b.length > a.length ? b : a));
      matched.add(best);
      continue;
    }
    unmatched.push(raw);
  }

  return { matched, unmatched };
}

/**
 * Runs entirely inside the page via `page.evaluate` — must stay fully
 * self-contained (no closures over Node-side variables). Walks every visible
 * text node, resolves foreground/effective background by painting to a 1x1
 * canvas (handles oklch/lab/oklab/color-mix exactly, no hand-written colour
 * maths), composites alpha, and computes the WCAG 2.x contrast ratio against
 * 4.5:1 normal / 3:1 large (>=24px, or >=18.66px bold).
 *
 * Excludes `.sr-only`-style clipped nodes by computed geometry/clip, not by
 * class name: this codebase's `.sr-only` (Tailwind v4 default) is
 * `position:absolute; width:1px; height:1px; overflow:hidden;
 * clip:rect(0,0,0,0)`, so a <=1px box or an explicit `clip: rect(0,0,0,0)`
 * both catch it directly from computed style.
 */
export function runContrastAudit(): ContrastAuditResult {
  const empty: ContrastAuditResult = { nodesChecked: 0, minRatio: null, failures: [] };

  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const maybeCtx2d = canvas.getContext("2d", { willReadFrequently: true });
  if (!maybeCtx2d) return empty;
  const ctx2d: CanvasRenderingContext2D = maybeCtx2d;

  const colorCache = new Map<string, RGBA>();

  function resolveColor(value: string): RGBA {
    if (!value) return { r: 0, g: 0, b: 0, a: 0 };
    const cached = colorCache.get(value);
    if (cached) return cached;
    ctx2d.clearRect(0, 0, 1, 1);
    ctx2d.fillStyle = value;
    ctx2d.fillRect(0, 0, 1, 1);
    const data = ctx2d.getImageData(0, 0, 1, 1).data;
    const resolved: RGBA = { r: data[0], g: data[1], b: data[2], a: data[3] / 255 };
    colorCache.set(value, resolved);
    return resolved;
  }

  function compositeOver(fg: RGBA, bg: RGBA): RGBA {
    const a = fg.a + bg.a * (1 - fg.a);
    if (a <= 0) return { r: 255, g: 255, b: 255, a: 0 };
    return {
      r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
      g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
      b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
      a,
    };
  }

  function effectiveBackground(el: Element): RGBA {
    const layers: RGBA[] = [];
    let node: Element | null = el;
    while (node) {
      const bg = resolveColor(getComputedStyle(node).backgroundColor);
      if (bg.a > 0) layers.push(bg);
      if (bg.a >= 0.999) break;
      node = node.parentElement;
    }
    if (layers.length === 0) return { r: 255, g: 255, b: 255, a: 1 };
    // layers[0] is the element's own background (topmost); layers[last] is
    // the furthest ancestor collected. Composite outermost-first so the
    // element's own layer paints last, on top.
    let composite = layers[layers.length - 1];
    if (composite.a < 0.999) composite = compositeOver(composite, { r: 255, g: 255, b: 255, a: 1 });
    for (let i = layers.length - 2; i >= 0; i--) {
      composite = compositeOver(layers[i], composite);
    }
    return composite;
  }

  function effectiveForeground(el: Element, bg: RGBA): RGBA {
    const fg = resolveColor(getComputedStyle(el).color);
    return fg.a >= 0.999 ? fg : compositeOver(fg, bg);
  }

  function srgbChannelToLinear(channel255: number): number {
    const c = channel255 / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function relativeLuminance(c: RGBA): number {
    return (
      0.2126 * srgbChannelToLinear(c.r) +
      0.7152 * srgbChannelToLinear(c.g) +
      0.0722 * srgbChannelToLinear(c.b)
    );
  }

  function contrastRatio(c1: RGBA, c2: RGBA): number {
    const l1 = relativeLuminance(c1);
    const l2 = relativeLuminance(c2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function isClippedOrHidden(el: Element): boolean {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.visibility === "collapse") return true;
    if (parseFloat(cs.opacity) === 0) return true;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 1 && rect.height <= 1) return true;
    if (/rect\(0px,?\s*0px,?\s*0px,?\s*0px\)/.test(cs.clip)) return true;
    return false;
  }

  function isVisible(el: Element): boolean {
    let node: Element | null = el;
    while (node) {
      if (isClippedOrHidden(node)) return false;
      node = node.parentElement;
    }
    return true;
  }

  function buildSelector(el: Element): string {
    const parts: string[] = [];
    let node: Element | null = el;
    let depth = 0;
    while (node && depth < 4) {
      let part = node.tagName.toLowerCase();
      if (node.id) {
        parts.unshift(`${part}#${node.id}`);
        break;
      }
      const classAttr = node.getAttribute("class");
      const classes = classAttr ? classAttr.trim().split(/\s+/).filter(Boolean).slice(0, 3) : [];
      if (classes.length) part += "." + classes.join(".");
      parts.unshift(part);
      node = node.parentElement;
      depth++;
    }
    return parts.join(" > ");
  }

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Node): number {
      const value = node.nodeValue;
      if (!value || !value.trim()) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "TEMPLATE") {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let nodesChecked = 0;
  let minRatio: number | null = null;
  const failures: ContrastFinding[] = [];

  let current: Node | null = walker.nextNode();
  while (current) {
    const textNode = current;
    const el = textNode.parentElement;
    current = walker.nextNode();
    if (!el) continue;
    if (el.getClientRects().length === 0) continue;
    if (!isVisible(el)) continue;

    nodesChecked++;
    const bg = effectiveBackground(el);
    const fg = effectiveForeground(el, bg);
    const ratio = contrastRatio(fg, bg);
    const cs = getComputedStyle(el);
    const fontSize = parseFloat(cs.fontSize);
    const fontWeightRaw = cs.fontWeight;
    const fontWeight = fontWeightRaw === "bold" ? 700 : parseInt(fontWeightRaw, 10) || 400;
    const isLarge = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
    const threshold = isLarge ? 3 : 4.5;

    if (minRatio === null || ratio < minRatio) minRatio = ratio;

    if (ratio < threshold) {
      failures.push({
        ratio: Math.round(ratio * 100) / 100,
        sample: (textNode.nodeValue ?? "").trim().slice(0, 40),
        selector: buildSelector(el),
        fg: `rgb(${Math.round(fg.r)}, ${Math.round(fg.g)}, ${Math.round(fg.b)})`,
        bg: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,
        fontSize: Math.round(fontSize * 100) / 100,
        fontWeight,
        isLarge,
        threshold,
      });
    }
  }

  failures.sort((a, b) => a.ratio - b.ratio);
  return { nodesChecked, minRatio, failures };
}

export function ensureTrailingSlash(url: string): string {
  const [pathPart, query] = url.split("?");
  const withSlash = pathPart.endsWith("/") ? pathPart : `${pathPart}/`;
  return query ? `${withSlash}?${query}` : withSlash;
}

export async function extractFirstHref(page: Page, selector: string): Promise<string | null> {
  const locator = page.locator(selector).first();
  const count = await locator.count().catch(() => 0);
  if (count === 0) return null;
  return (await locator.getAttribute("href").catch(() => null)) ?? null;
}

export function extractIdFromHref(href: string | null, prefix: string): string | null {
  if (!href) return null;
  if (!href.startsWith(prefix)) return null;
  const rest = href.slice(prefix.length);
  const id = rest.split(/[/?#]/)[0];
  return id || null;
}

interface ThemeSetResult {
  mechanism: "theme-root" | "html-fallback";
  applied: boolean;
}

/**
 * Sets the theme directly on `[data-admin-theme-root]` — never through the
 * theme control, so no `theme_preference` write reaches the database.
 *
 * Unauthenticated pages (`/admin/login`, `/admin/password-reset`) never
 * mount `ThemeProvider` (src/app/admin/layout.tsx returns `children` as-is
 * when `getStaffProfile` resolves null), so `[data-admin-theme-root]` is
 * absent there. Fallback: `tokens.css`'s `[data-theme="dark"]` /
 * `[data-theme="light"]` blocks are UNSCOPED attribute selectors (not only
 * `[data-admin-theme-root][data-theme=...]`), so setting the attribute on
 * `<html>` still activates the palette via custom-property inheritance —
 * even though production code (ThemeProvider.tsx, Owner decision
 * 2026-07-31) deliberately never does this itself. This is a measurement-only
 * fallback in the test, not a production code change.
 */
export async function setAdminTheme(page: Page, theme: AdminTheme): Promise<ThemeSetResult> {
  return page.evaluate((t) => {
    const root = document.querySelector("[data-admin-theme-root]");
    if (root) {
      root.setAttribute("data-theme", t);
      return {
        mechanism: "theme-root" as const,
        applied: root.getAttribute("data-theme") === t,
      };
    }
    document.documentElement.setAttribute("data-theme", t);
    return {
      mechanism: "html-fallback" as const,
      applied: document.documentElement.getAttribute("data-theme") === t,
    };
  }, theme);
}

/**
 * ⛔ WHY THIS EXISTS — the sweep's light-theme numbers were not reproducible.
 *
 * `THEMES` is ["dark", "light"], so every route is audited in dark first and
 * then FLIPPED to light. `setAdminTheme` only sets the attribute; the audit ran
 * on the very next line. The admin applies `transition-colors` at
 * `--motion-duration-fast` (160ms) on cards, rows, chips and links throughout,
 * so the light pass was sampling a page part-way through a 160ms dark->light
 * interpolation, while the dark pass sampled an already-settled page.
 *
 * Measured before this fix, on identical code with identical node counts:
 * `/admin/audit` OWNER-light reported 225 failures on one run and 115 on the
 * next, and `/admin/availability` 34 then 57 — while all four dark files
 * matched to the unit. The light files also recorded colours that exist in
 * NEITHER palette (e.g. rgb(131,133,128) on rgb(124,122,118)) and, on some
 * rows, the dark canvas as a background.
 *
 * Suppressing transitions — not animations — makes both passes read the settled
 * end state, which is what a contrast audit is supposed to measure. Animations
 * are deliberately left alone: `animate-pulse` skeletons and `motion-safe:
 * animate-in` entrances would change what is on screen if disabled, whereas a
 * transition only interpolates between two states this audit already samples.
 */
async function suppressColourTransitions(page: Page): Promise<void> {
  await page
    .addStyleTag({
      content: `*, *::before, *::after { transition: none !important; }`,
    })
    .catch(() => {
      /* a CSP-blocked style tag must not fail the sweep; the audit still runs,
         it is only the light half that becomes noisy again. */
    });
}

// AdminAccessDenied (src/app/admin/components/admin-ui.tsx) always renders
// this CTA link when a non-inactive denial is shown in place (same URL,
// HTTP 200) — a title-text-independent, code-grounded detection signal.
const DENIED_CTA_PATTERN = /^Back to (dashboard|My day)$/i;

export async function visitAndAudit(page: Page, templatePath: string, rawUrl: string): Promise<RouteEntry> {
  const kind: "static" | "dynamic" = templatePath.includes("[") ? "dynamic" : "static";
  const url = ensureTrailingSlash(rawUrl);
  const entry: RouteEntry = { path: templatePath, kind, resolvedUrl: url, outcome: "audited", themes: {} };

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  } catch (error) {
    entry.outcome = "unreachable";
    entry.reason = `navigation error: ${error instanceof Error ? error.message : String(error)}`;
    return entry;
  }
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

  const requestedPathname = url.split("?")[0];
  const landedPathname = new URL(page.url()).pathname;
  if (landedPathname !== requestedPathname) {
    entry.outcome = "redirected";
    entry.landedUrl = page.url();
    return entry;
  }

  const deniedCount = await page
    .getByRole("link", { name: DENIED_CTA_PATTERN })
    .count()
    .catch(() => 0);
  if (deniedCount > 0) {
    entry.outcome = "denied-inline";
    entry.landedUrl = page.url();
    return entry;
  }

  await suppressColourTransitions(page);

  for (const theme of THEMES) {
    const themeResult = await setAdminTheme(page, theme);
    if (!themeResult.applied) {
      throw new Error(
        `Theme attribute failed to apply (theme=${theme}, mechanism=${themeResult.mechanism}) on ${url}`
      );
    }
    const audit = await page.evaluate(runContrastAudit);
    entry.themes[theme] = { ...audit, mechanism: themeResult.mechanism };
  }

  return entry;
}

/**
 * Sweeps the 29 role-loop admin routes (21 static minus login/password-reset,
 * plus 10 dynamic) for the currently authenticated role. Dynamic ids are
 * resolved at runtime from the corresponding list page's DOM — never
 * hardcoded. `routeFilter`, when provided, restricts which route templates
 * get their own audited entry (used by CONTRAST_ROUTES for smoke runs);
 * prerequisite list pages are still visited silently (not recorded) when a
 * filtered-in dynamic route needs an id from a filtered-out list route.
 */
export async function sweepAdminRoutes(page: Page, routeFilter: Set<string> | null): Promise<RouteEntry[]> {
  const entries: RouteEntry[] = [];

  function want(routePath: string): boolean {
    return !routeFilter || routeFilter.has(routePath);
  }

  async function audit(templatePath: string, url: string): Promise<RouteEntry> {
    const entry = await visitAndAudit(page, templatePath, url);
    entries.push(entry);
    return entry;
  }

  async function silentVisit(url: string): Promise<void> {
    await page
      .goto(ensureTrailingSlash(url), { waitUntil: "domcontentloaded", timeout: 45_000 })
      .catch(() => {});
  }

  function markUnreachable(templatePath: string, reason: string): void {
    entries.push({ path: templatePath, kind: "dynamic", outcome: "unreachable", reason, themes: {} });
  }

  // 1. Dashboard
  if (want("/admin/dashboard")) await audit("/admin/dashboard", "/admin/dashboard");

  // 2. Bookings list (+ resolve bookingId)
  const BOOKING_LINK = 'article a[href^="/admin/bookings/"]:not([href^="/admin/bookings/new"])';
  let bookingHref: string | null = null;
  const needsBookingId = routeFilter
    ? routeFilter.has("/admin/bookings/[bookingId]") || routeFilter.has("/admin/bookings/series/[templateId]")
    : true;
  if (want("/admin/bookings")) {
    const e = await audit("/admin/bookings", "/admin/bookings");
    if (e.outcome === "audited") bookingHref = await extractFirstHref(page, BOOKING_LINK);
  } else if (needsBookingId) {
    await silentVisit("/admin/bookings");
    bookingHref = await extractFirstHref(page, BOOKING_LINK);
  }

  // 3. New booking
  if (want("/admin/bookings/new")) await audit("/admin/bookings/new", "/admin/bookings/new");

  // 4. Booking detail
  let bookingDetailAudited = false;
  if (want("/admin/bookings/[bookingId]")) {
    if (bookingHref) {
      const e = await audit("/admin/bookings/[bookingId]", bookingHref);
      bookingDetailAudited = e.outcome === "audited";
    } else {
      markUnreachable("/admin/bookings/[bookingId]", "no data: bookings list has no rows visible to this role");
    }
  }

  // 5. Booking series (recurring_booking_templates has 0 rows — expected unreachable)
  if (want("/admin/bookings/series/[templateId]")) {
    let seriesHref: string | null = null;
    if (bookingHref) {
      if (!bookingDetailAudited) await silentVisit(bookingHref);
      seriesHref = await extractFirstHref(page, 'a[href^="/admin/bookings/series/"]');
    }
    if (seriesHref) {
      await audit("/admin/bookings/series/[templateId]", seriesHref);
    } else {
      markUnreachable(
        "/admin/bookings/series/[templateId]",
        "no data: recurring_booking_templates has 0 rows, so no booking links to a series"
      );
    }
  }

  // 6. Clients list (+ resolve clientId)
  const CLIENT_LINK = 'li a[href^="/admin/clients/"]:not([href^="/admin/clients/new"])';
  let clientId: string | null = null;
  const needsClientId = routeFilter
    ? routeFilter.has("/admin/clients/[clientId]") || routeFilter.has("/admin/clients/[clientId]/edit")
    : true;
  if (want("/admin/clients")) {
    const e = await audit("/admin/clients", "/admin/clients");
    if (e.outcome === "audited") {
      clientId = extractIdFromHref(await extractFirstHref(page, CLIENT_LINK), "/admin/clients/");
    }
  } else if (needsClientId) {
    await silentVisit("/admin/clients");
    clientId = extractIdFromHref(await extractFirstHref(page, CLIENT_LINK), "/admin/clients/");
  }

  if (want("/admin/clients/new")) await audit("/admin/clients/new", "/admin/clients/new");

  if (want("/admin/clients/[clientId]")) {
    if (clientId) await audit("/admin/clients/[clientId]", `/admin/clients/${clientId}`);
    else markUnreachable("/admin/clients/[clientId]", "no data: clients list has no rows visible to this role");
  }
  if (want("/admin/clients/[clientId]/edit")) {
    if (clientId) await audit("/admin/clients/[clientId]/edit", `/admin/clients/${clientId}/edit`);
    else markUnreachable("/admin/clients/[clientId]/edit", "no data: clients list has no rows visible to this role");
  }

  if (want("/admin/enquiries")) await audit("/admin/enquiries", "/admin/enquiries");
  if (want("/admin/calendar")) await audit("/admin/calendar", "/admin/calendar");

  // Staff list (+ resolve staffId)
  const STAFF_LINK = 'a[href^="/admin/staff/"]';
  let staffId: string | null = null;
  const needsStaffId = routeFilter
    ? routeFilter.has("/admin/staff/[staffId]") ||
      routeFilter.has("/admin/staff/[staffId]/availability") ||
      routeFilter.has("/admin/staff/[staffId]/performance")
    : true;
  if (want("/admin/staff")) {
    const e = await audit("/admin/staff", "/admin/staff");
    if (e.outcome === "audited") {
      staffId = extractIdFromHref(await extractFirstHref(page, STAFF_LINK), "/admin/staff/");
    }
  } else if (needsStaffId) {
    await silentVisit("/admin/staff");
    staffId = extractIdFromHref(await extractFirstHref(page, STAFF_LINK), "/admin/staff/");
  }

  if (want("/admin/staff/[staffId]")) {
    if (staffId) await audit("/admin/staff/[staffId]", `/admin/staff/${staffId}`);
    else markUnreachable("/admin/staff/[staffId]", "no data: staff list has no rows visible to this role");
  }
  if (want("/admin/staff/[staffId]/availability")) {
    if (staffId) await audit("/admin/staff/[staffId]/availability", `/admin/staff/${staffId}/availability`);
    else
      markUnreachable(
        "/admin/staff/[staffId]/availability",
        "no data: staff list has no rows visible to this role"
      );
  }
  if (want("/admin/staff/[staffId]/performance")) {
    if (staffId) await audit("/admin/staff/[staffId]/performance", `/admin/staff/${staffId}/performance`);
    else
      markUnreachable(
        "/admin/staff/[staffId]/performance",
        "no data: staff list has no rows visible to this role"
      );
  }

  if (want("/admin/availability")) await audit("/admin/availability", "/admin/availability");
  if (want("/admin/services")) await audit("/admin/services", "/admin/services");
  if (want("/admin/settings")) await audit("/admin/settings", "/admin/settings");
  if (want("/admin/operations")) await audit("/admin/operations", "/admin/operations");
  if (want("/admin/emails")) await audit("/admin/emails", "/admin/emails");

  // /admin/emails defaults to the "delivery"/"reminders" tab — the template
  // gallery (and any /admin/emails/templates/... link) only mounts with
  // ?tab=templates, so resolution needs its own navigation regardless of
  // whether /admin/emails itself was in scope.
  if (want("/admin/emails/templates/[templateId]")) {
    await silentVisit("/admin/emails?tab=templates");
    const templateHref = await extractFirstHref(page, 'a[href^="/admin/emails/templates/"]');
    if (templateHref) {
      await audit("/admin/emails/templates/[templateId]", templateHref);
    } else {
      markUnreachable(
        "/admin/emails/templates/[templateId]",
        "no data: template gallery has no entries visible to this role"
      );
    }
  }

  // Roles list (+ resolve roleId)
  let roleId: string | null = null;
  const needsRoleId = routeFilter ? routeFilter.has("/admin/roles/[roleId]") : true;
  if (want("/admin/roles")) {
    const e = await audit("/admin/roles", "/admin/roles");
    if (e.outcome === "audited") {
      roleId = extractIdFromHref(await extractFirstHref(page, 'a[href^="/admin/roles/"]'), "/admin/roles/");
    }
  } else if (needsRoleId) {
    await silentVisit("/admin/roles");
    roleId = extractIdFromHref(await extractFirstHref(page, 'a[href^="/admin/roles/"]'), "/admin/roles/");
  }
  if (want("/admin/roles/[roleId]")) {
    if (roleId) await audit("/admin/roles/[roleId]", `/admin/roles/${roleId}`);
    else markUnreachable("/admin/roles/[roleId]", "no data: roles list has no rows visible to this role");
  }

  if (want("/admin/privacy")) await audit("/admin/privacy", "/admin/privacy");
  if (want("/admin/account-password-requests"))
    await audit("/admin/account-password-requests", "/admin/account-password-requests");
  if (want("/admin/audit")) await audit("/admin/audit", "/admin/audit");
  if (want("/admin/reports")) await audit("/admin/reports", "/admin/reports");
  if (want("/admin/me")) await audit("/admin/me", "/admin/me");

  // Needs a real, unforgeable reset token — never invented. Recorded as
  // coverage information, not attempted.
  if (want("/admin/password-reset/[token]")) {
    markUnreachable("/admin/password-reset/[token]", "no data: requires a real reset token, never invented");
  }

  return entries;
}

function escapeMd(text: string): string {
  return text.replace(/\|/g, "\\|");
}

export function renderRoleThemeReport(role: string, theme: AdminTheme, entries: RouteEntry[]): string {
  const lines: string[] = [];
  lines.push(`# Admin contrast sweep — ${role} / ${theme}`);
  lines.push("");
  lines.push(
    "Generated by `e2e/admin-contrast.spec.ts` (ITEM 7 §7.9(b), Layer 3). Theme was set directly on " +
      "`[data-admin-theme-root]` (or the documented html-fallback where that element is absent) — never " +
      "through the theme control, so no `theme_preference` write reached the database."
  );
  lines.push("");
  lines.push("## Per-route summary");
  lines.push("");
  lines.push("| Route | Outcome | Nodes checked | Failures | Worst ratio | Theme mechanism |");
  lines.push("|---|---|---|---|---|---|");
  for (const entry of entries) {
    if (entry.outcome === "audited") {
      const audit = entry.themes[theme];
      lines.push(
        `| \`${entry.path}\` | audited | ${audit?.nodesChecked ?? "—"} | ${audit?.failures.length ?? "—"} | ` +
          `${audit?.minRatio != null ? audit.minRatio.toFixed(2) + ":1" : "—"} | ${audit?.mechanism ?? "—"} |`
      );
    } else if (entry.outcome === "redirected") {
      lines.push(`| \`${entry.path}\` | redirected → \`${entry.landedUrl}\` | — | — | — | — |`);
    } else if (entry.outcome === "denied-inline") {
      lines.push(`| \`${entry.path}\` | denied (same URL, 200) | — | — | — | — |`);
    } else {
      lines.push(`| \`${entry.path}\` | unreachable — ${entry.reason ?? ""} | — | — | — | — |`);
    }
  }
  lines.push("");

  const worst = entries
    .filter((e) => e.outcome === "audited" && e.themes[theme])
    .flatMap((e) => (e.themes[theme]?.failures ?? []).map((f) => ({ ...f, route: e.path })))
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 15);

  lines.push("## Worst findings (up to 15)");
  lines.push("");
  if (worst.length === 0) {
    lines.push("No contrast failures recorded on any audited route in this theme.");
  } else {
    lines.push("| Ratio | Route | Text | Selector | Foreground | Background | Font |");
    lines.push("|---|---|---|---|---|---|---|");
    for (const f of worst) {
      lines.push(
        `| ${f.ratio.toFixed(2)}:1 | \`${f.route}\` | "${escapeMd(f.sample)}" | \`${escapeMd(f.selector)}\` | ` +
          `${f.fg} | ${f.bg} | ${f.fontSize}px / ${f.fontWeight}${f.isLarge ? " (large)" : ""} |`
      );
    }
  }
  lines.push("");

  const unreachable = entries.filter((e) => e.outcome === "unreachable");
  const redirected = entries.filter((e) => e.outcome === "redirected");
  const denied = entries.filter((e) => e.outcome === "denied-inline");

  lines.push("## Unreachable routes (coverage gap, not a pass)");
  lines.push("");
  lines.push(
    unreachable.length
      ? unreachable.map((e) => `- \`${e.path}\` — ${e.reason ?? "unknown reason"}`).join("\n")
      : "None."
  );
  lines.push("");
  lines.push("## Redirected (permission/auth boundary — expected coverage data)");
  lines.push("");
  lines.push(redirected.length ? redirected.map((e) => `- \`${e.path}\` → \`${e.landedUrl}\``).join("\n") : "None.");
  lines.push("");
  lines.push("## Denied inline (same URL, HTTP 200, AdminAccessDenied rendered)");
  lines.push("");
  lines.push(denied.length ? denied.map((e) => `- \`${e.path}\``).join("\n") : "None.");
  lines.push("");

  const totalFailures = entries.reduce((sum, e) => sum + (e.themes[theme]?.failures.length ?? 0), 0);
  const totalNodes = entries.reduce((sum, e) => sum + (e.themes[theme]?.nodesChecked ?? 0), 0);
  lines.push("## Totals");
  lines.push("");
  lines.push(`- Routes audited: ${entries.filter((e) => e.outcome === "audited").length}`);
  lines.push(`- Routes redirected: ${redirected.length}`);
  lines.push(`- Routes denied inline: ${denied.length}`);
  lines.push(`- Routes unreachable: ${unreachable.length}`);
  lines.push(`- Text nodes checked (${theme}): ${totalNodes}`);
  lines.push(`- Contrast failures (${theme}): ${totalFailures}`);
  lines.push("");

  return lines.join("\n");
}

export function renderSummaryReport(
  roleResults: RoleRunResult[],
  allRoles: readonly string[],
  unauthenticated: RoleRunResult[],
  inactiveOutcome: "redirected" | "not-redirected" | "skipped"
): string {
  const lines: string[] = [];
  lines.push("# Admin contrast sweep — combined summary");
  lines.push("");
  const maxFailuresEnv = process.env.CONTRAST_MAX_FAILURES;
  lines.push(
    `Generated ${new Date().toISOString()}. Mode: ${
      maxFailuresEnv
        ? `asserting (CONTRAST_MAX_FAILURES=${maxFailuresEnv})`
        : "report-only (no failure ceiling set — always passes, findings recorded for the ratchet)"
    }.`
  );
  lines.push("");
  lines.push("## Per role / theme totals");
  lines.push("");
  lines.push("| Role | Theme | Audited | Redirected | Denied inline | Unreachable | Failures |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const { role, entries } of [...unauthenticated, ...roleResults]) {
    for (const theme of THEMES) {
      const audited = entries.filter((e) => e.outcome === "audited").length;
      const redirected = entries.filter((e) => e.outcome === "redirected").length;
      const denied = entries.filter((e) => e.outcome === "denied-inline").length;
      const unreachable = entries.filter((e) => e.outcome === "unreachable").length;
      const failures = entries.reduce((sum, e) => sum + (e.themes[theme]?.failures.length ?? 0), 0);
      lines.push(`| ${role} | ${theme} | ${audited} | ${redirected} | ${denied} | ${unreachable} | ${failures} |`);
    }
  }
  lines.push("");

  lines.push("## Roles not included in this run");
  lines.push("");
  const ran = new Set(roleResults.map((r) => r.role));
  const notes = allRoles.filter((r) => !ran.has(r));
  lines.push(
    notes.length
      ? notes
          .map((r) => `- **${r}**: not run — missing credentials, excluded by CONTRAST_ROLES, or out of this run's scope`)
          .join("\n")
      : "All roles ran."
  );
  lines.push("");

  lines.push("## INACTIVE (negative path — not contrast-audited)");
  lines.push("");
  lines.push(
    inactiveOutcome === "redirected"
      ? "Confirmed: INACTIVE credentials, when present, are redirected away from `/admin/dashboard` back to `/admin/login`."
      : inactiveOutcome === "skipped"
        ? "Skipped — E2E_INACTIVE_EMAIL/PASSWORD not set."
        : "UNEXPECTED: INACTIVE was not redirected away from the admin dashboard."
  );
  lines.push("");

  return lines.join("\n");
}

export function writeEvidenceFile(fileName: string, content: string): void {
  const dir = path.join(process.cwd(), "redesign", "evidence", "admin-contrast");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fileName), content, "utf8");
}
