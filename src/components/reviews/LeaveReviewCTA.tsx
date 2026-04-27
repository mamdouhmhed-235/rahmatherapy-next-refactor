import Link from "next/link";
import { ExternalLink, Star } from "lucide-react";
import { googleReviewsUrl } from "@/lib/content/reviews";

export function LeaveReviewCTA() {
  return (
    <section className="bg-rahma-ivory px-5 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 rounded-3xl bg-rahma-green p-6 text-white shadow-card sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center lg:p-10">
          <div>
            <div className="mb-5 flex gap-1 text-rahma-gold" aria-hidden="true">
              {Array.from({ length: 5 }, (_, index) => (
                <Star key={index} size={18} className="fill-current" />
              ))}
            </div>
            <h2 className="font-display text-3xl font-medium leading-tight sm:text-4xl">
              Already had a session with Rahma Therapy?
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/78 sm:text-lg">
              Your review helps other people in Luton feel confident before booking hijama,
              cupping or massage at home.
            </p>
          </div>
          <Link
            href={googleReviewsUrl}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-rahma-green transition hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Open Google listing
            <ExternalLink aria-hidden="true" size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
