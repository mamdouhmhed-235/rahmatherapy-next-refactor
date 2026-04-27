import { serviceTrustItems } from "@/content/pages/services";
import { ServicesIcon } from "./ServicesIcon";

export function ServicesTrustStrip() {
  return (
    <section className="bg-white px-5 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {serviceTrustItems.map((item) => (
          <article
            key={item.title}
            className="rounded-3xl border border-rahma-border bg-white p-6 shadow-sm"
          >
            <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-rahma-ivory text-rahma-green">
              <ServicesIcon name={item.icon} />
            </div>
            <h2 className="text-lg font-semibold text-rahma-charcoal">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-rahma-muted">{item.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
