import { ClipboardCheck, Home, ShieldCheck, Users } from "lucide-react";
import { homeTrustItems } from "@/content/pages/home";

const icons = {
  ShieldCheck,
  Home,
  Users,
  ClipboardCheck,
} as const;

export function HomeTrustStrip() {
  return (
    <section className="bg-white px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {homeTrustItems.map((item) => {
          const Icon = icons[item.icon];
          return (
            <article
              key={item.title}
              className="rounded-3xl border border-rahma-border bg-white p-6 shadow-soft"
            >
              <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-rahma-ivory text-rahma-green">
                <Icon aria-hidden="true" size={22} />
              </div>
              <p className="text-lg font-semibold text-rahma-charcoal">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-rahma-muted">{item.body}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
