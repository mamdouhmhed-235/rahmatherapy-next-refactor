import { permanentRedirect } from "next/navigation";

// The site's homepage canonically lives at /home (every nav/footer/logo link
// points there). Serving identical content at "/" too created duplicate content
// with no canonical. Permanently redirect "/" → "/home" (HTTP 308) so there is a
// single indexable homepage URL and link equity consolidates.
export default function RootPage() {
  // Trailing slash included deliberately: next.config.ts sets trailingSlash,
  // so redirecting to "/home" would 308 again to "/home/" — two hops on the
  // site's strongest URL, the one people type and link to.
  permanentRedirect("/home/");
}
