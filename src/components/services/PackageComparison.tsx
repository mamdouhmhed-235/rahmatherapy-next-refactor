import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { SectionContainer, SectionHeading } from "@/components/shared";
import { comparisonRows, servicePackages } from "@/content/pages/services";

const packageColumns = [
  { key: "supremeCombo", label: "Supreme Combo" },
  { key: "hijama", label: "Hijama Package" },
  { key: "firePackage", label: "Fire Package" },
  { key: "massage30", label: "Massage 30 mins" },
  { key: "massage60", label: "Massage 1 hour" },
] as const;

export function PackageComparison() {
  return (
    <SectionContainer id="compare-packages" tone="ivory" width="wide">
      <SectionHeading
        align="center"
        title="Compare what’s included"
        description="A simple side-by-side view of Rahma Therapy’s packages, so you can choose based on what you want from the session."
        className="mx-auto"
      />
      <div className="mt-12 hidden overflow-hidden rounded-3xl border border-rahma-border bg-white shadow-sm lg:block">
        <table className="w-full table-fixed border-collapse text-left">
          <thead className="bg-rahma-green text-white">
            <tr>
              <th className="w-[17%] px-4 py-5 text-sm font-semibold">Feature</th>
              {packageColumns.map((column) => (
                <th key={column.key} className="px-4 py-5 text-sm font-semibold">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparisonRows.map((row) => (
              <tr key={row.feature} className="border-t border-rahma-border">
                <th className="bg-rahma-ivory/70 px-4 py-4 text-sm font-semibold text-rahma-charcoal">
                  {row.feature}
                </th>
                {packageColumns.map((column) => (
                  <td
                    key={column.key}
                    className="px-4 py-4 text-sm leading-6 text-rahma-muted"
                  >
                    {row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-10 grid gap-4 lg:hidden">
        {servicePackages.map((service) => (
          <article
            key={service.id}
            className="rounded-3xl border border-rahma-border bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-xl font-semibold text-rahma-charcoal">{service.title}</h3>
              <strong className="shrink-0 text-lg text-rahma-green">{service.price}</strong>
            </div>
            <p className="mt-4 text-sm font-semibold text-rahma-charcoal">
              Included methods
            </p>
            <ul className="mt-2 grid gap-2 text-sm leading-6 text-rahma-muted">
              {service.includes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="mt-4 text-sm font-semibold text-rahma-charcoal">Best for</p>
            <p className="mt-2 text-sm leading-6 text-rahma-muted">{service.bestFor}</p>
          </article>
        ))}
      </div>
      <div className="mt-10 flex flex-col items-center gap-4 text-center">
        <p className="text-lg font-semibold text-rahma-charcoal">
          Still unsure? Tell us what you need and we’ll guide you.
        </p>
        <Link
          href="https://wa.me/447798897222?text=Assalamu%20alaykum%2C%20I%27m%20not%20sure%20which%20Rahma%20Therapy%20package%20to%20book.%20Can%20you%20help%3F"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-rahma-green px-6 text-sm font-semibold text-white transition hover:bg-rahma-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue"
        >
          <MessageCircle aria-hidden="true" size={17} />
          Ask on WhatsApp
        </Link>
      </div>
    </SectionContainer>
  );
}
