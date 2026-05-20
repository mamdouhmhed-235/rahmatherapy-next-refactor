"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AUDIENCE_GROUPS,
  type TemplateAudience,
  type TemplateMeta,
  templatesByAudience,
} from "./templates-data";

interface TemplateBrowserProps {
  templates: TemplateMeta[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSend: (id: string) => void;
  canSendForTemplate?: (template: TemplateMeta) => boolean;
}

export function TemplateBrowser({
  selectedId,
  onSelect,
  onSend,
  canSendForTemplate,
}: TemplateBrowserProps) {
  // Mobile groups default-collapsed; desktop default-open. Detect once.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const fn = () => setIsMobile(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  const [openGroups, setOpenGroups] = useState<Record<TemplateAudience, boolean>>(() => ({
    customer: true,
    staff: true,
    admin_internal: true,
  }));

  // When mobile transitions in, collapse all. When transitioning back to desktop, open all.
  useEffect(() => {
    setOpenGroups({
      customer: !isMobile,
      staff: !isMobile,
      admin_internal: !isMobile,
    });
  }, [isMobile]);

  const [query, setQuery] = useState("");
  const searchId = useId();
  const norm = (s: string) => s.toLowerCase().trim();
  const q = norm(query);

  // When the operator types a query, auto-expand any group containing a match
  // so they don't have to twirl groups open one by one.
  useEffect(() => {
    if (!q) return;
    const next: Record<TemplateAudience, boolean> = {
      customer: false,
      staff: false,
      admin_internal: false,
    };
    for (const g of AUDIENCE_GROUPS) {
      const hit = templatesByAudience(g.id).some(
        (t) =>
          norm(t.cardName).includes(q) || norm(t.trigger).includes(q)
      );
      next[g.id] = hit;
    }
    setOpenGroups(next);
  }, [q]);

  function toggleGroup(id: TemplateAudience) {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function matches(t: TemplateMeta): boolean {
    if (!q) return true;
    return norm(t.cardName).includes(q) || norm(t.trigger).includes(q);
  }

  // Flat list of currently-visible template ids in render order, for arrow-key nav.
  const visibleIds: string[] = useMemo(() => {
    const ids: string[] = [];
    for (const g of AUDIENCE_GROUPS) {
      if (openGroups[g.id]) {
        for (const t of templatesByAudience(g.id)) {
          if (matches(t)) ids.push(t.id);
        }
      }
    }
    return ids;
  }, [openGroups, q]); // eslint-disable-line react-hooks/exhaustive-deps

  function focusCardAt(index: number) {
    const clamped = Math.max(0, Math.min(visibleIds.length - 1, index));
    const id = visibleIds[clamped];
    if (!id) return;
    document.getElementById(`tpl-card-${id}`)?.focus();
  }

  return (
    <nav aria-label="Email templates" className="flex flex-col gap-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--admin-text-muted)]"
          aria-hidden="true"
        />
        <label htmlFor={searchId} className="sr-only">
          Filter templates
        </label>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter templates"
          className="h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-input)] pl-8 pr-9 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus:border-[var(--admin-focus)] focus:ring-2 focus:ring-[var(--admin-focus)]/55"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear filter"
            className="absolute right-1 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-[var(--admin-radius-control)] text-[var(--admin-text-muted)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {q && visibleIds.length === 0 ? (
        <p className="rounded-[var(--admin-radius-control)] bg-[var(--admin-panel-muted)] px-3 py-2.5 text-xs leading-relaxed text-[var(--admin-text-muted)]">
          No templates match &ldquo;{query}&rdquo;.
        </p>
      ) : null}

      {AUDIENCE_GROUPS.map((group) => {
        const items = templatesByAudience(group.id).filter(matches);
        const open = openGroups[group.id];
        if (q && items.length === 0) return null;
        return (
          <TemplateGroup
            key={group.id}
            label={group.label}
            count={items.length}
            open={open}
            onToggle={() => toggleGroup(group.id)}
          >
            <ul className="mt-1 flex flex-col">
              {items.map((tpl) => {
                const active = selectedId === tpl.id;
                const sendAllowed = canSendForTemplate ? canSendForTemplate(tpl) : true;
                return (
                  <TemplateRow
                    key={tpl.id}
                    template={tpl}
                    active={active}
                    sendAllowed={sendAllowed}
                    onSelect={() => onSelect(tpl.id)}
                    onSend={() => onSend(tpl.id)}
                    onKeyboardNav={(direction, key) => {
                      const i = visibleIds.indexOf(tpl.id);
                      if (key === "Enter" || key === " ") {
                        onSelect(tpl.id);
                      } else if (direction === "down") {
                        focusCardAt(i + 1);
                      } else if (direction === "up") {
                        focusCardAt(i - 1);
                      } else if (direction === "home") {
                        focusCardAt(0);
                      } else if (direction === "end") {
                        focusCardAt(visibleIds.length - 1);
                      }
                    }}
                  />
                );
              })}
            </ul>
          </TemplateGroup>
        );
      })}
    </nav>
  );
}

interface TemplateGroupProps {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function TemplateGroup({ label, count, open, onToggle, children }: TemplateGroupProps) {
  const headingId = useId();
  const contentId = useId();
  return (
    <div className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-1.5">
      <h2 id={headingId} className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={onToggle}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              onToggle();
            }
          }}
          className="flex min-h-11 w-full items-center gap-2 rounded-[var(--admin-radius-control)] px-2.5 text-left text-base font-semibold tracking-[-0.01em] text-[var(--admin-heading)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
        >
          <span
            aria-hidden="true"
            className="inline-flex size-5 shrink-0 items-center justify-center text-[var(--admin-text-muted)] transition-transform duration-[160ms] ease-out motion-reduce:transition-none"
            style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
          >
            <ChevronDown className="size-4" />
          </span>
          <span className="flex-1 font-display">{label}</span>
          <span
            className="text-xs font-medium text-[var(--admin-text-muted)]"
            title={`${count} templates in this group`}
          >
            {count} {count === 1 ? "template" : "templates"}
          </span>
        </button>
      </h2>
      <div
        id={contentId}
        role="region"
        aria-labelledby={headingId}
        hidden={!open}
        className={cn(
          "overflow-hidden",
          open
            ? "grid-rows-[1fr] border-t border-[var(--admin-border)] mt-1.5 pt-1"
            : "grid-rows-[0fr]",
          "grid transition-[grid-template-rows] duration-[160ms] ease-out motion-reduce:transition-none"
        )}
      >
        <div className="min-h-0">{children}</div>
      </div>
    </div>
  );
}

interface TemplateRowProps {
  template: TemplateMeta;
  active: boolean;
  sendAllowed: boolean;
  onSelect: () => void;
  onSend: () => void;
  onKeyboardNav: (direction: "up" | "down" | "home" | "end" | null, key: string) => void;
}

function TemplateRow({
  template,
  active,
  sendAllowed,
  onSelect,
  onSend,
  onKeyboardNav,
}: TemplateRowProps) {
  const cardRef = useRef<HTMLButtonElement | null>(null);
  return (
    <li className="contents">
      <div
        className={cn(
          "group relative flex items-center gap-1 border-b border-[var(--admin-border)] last:border-b-0 transition-colors duration-150 motion-reduce:transition-none",
          active && "bg-[var(--admin-selected-sky)]"
        )}
        style={
          active
            ? {
                boxShadow:
                  "inset 0 0 0 1px var(--admin-border-form), 0 1px 0 oklch(22% 0.085 155 / 0.06)",
              }
            : undefined
        }
      >
        <button
          ref={cardRef}
          id={`tpl-card-${template.id}`}
          type="button"
          onClick={onSelect}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              onKeyboardNav("down", e.key);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              onKeyboardNav("up", e.key);
            } else if (e.key === "Home") {
              e.preventDefault();
              onKeyboardNav("home", e.key);
            } else if (e.key === "End") {
              e.preventDefault();
              onKeyboardNav("end", e.key);
            } else if (e.key === "Enter" || e.key === " ") {
              // Native click handles Enter on buttons, but Space on a div-wrapped button
              // sometimes scrolls — let it through to onClick.
              onKeyboardNav(null, e.key);
            }
          }}
          aria-pressed={active}
          className={cn(
            "min-h-11 min-w-0 flex-1 rounded-[var(--admin-radius-control)] px-2.5 py-2 text-left outline-none transition-colors",
            "focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55",
            !active && "hover:bg-[var(--admin-panel-muted)]"
          )}
        >
          <h3
            className={cn(
              "m-0 truncate text-sm tracking-[-0.005em] text-[var(--admin-heading)]",
              active ? "font-semibold" : "font-medium"
            )}
          >
            {template.cardName}
          </h3>
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[var(--admin-text-muted)]">
            {template.trigger}
          </p>
        </button>
        {sendAllowed ? (
          <button
            type="button"
            onClick={onSend}
            aria-label={`Send ${template.cardName}`}
            title={`Send ${template.cardName}`}
            className="inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-[var(--admin-radius-control)] px-2.5 text-xs font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            <Send className="size-4" aria-hidden="true" />
            <span>Send</span>
          </button>
        ) : null}
      </div>
    </li>
  );
}
