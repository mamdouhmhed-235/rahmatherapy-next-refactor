import { Star } from "lucide-react";

const stats = [
  { value: "2020", label: "Serving Luton since" },
  { value: "500+", label: "Clients supported" },
  { value: "5.0", label: "Average Google rating", star: true },
  { value: "CMA & IPHM", label: "Qualified therapists" },
] as const;

export function AreaStats() {
  return (
    <section className="bg-rahma-charcoal px-5 py-10 sm:px-6 lg:px-8 lg:py-12">
      <div className="mx-auto grid max-w-7xl gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col items-center text-center sm:items-start sm:text-left">
            <div className="flex items-center gap-2">
              <span className="font-display text-3xl font-semibold text-white sm:text-4xl">{s.value}</span>
              {"star" in s && s.star ? (
                <Star aria-hidden="true" size={22} className="fill-rahma-gold text-rahma-gold" />
              ) : null}
            </div>
            <p className="mt-1.5 text-sm font-medium uppercase tracking-[0.12em] text-white/65">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
