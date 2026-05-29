import { permanentRedirect } from "next/navigation";

// The site's homepage canonically lives at /home (every nav/footer/logo link
// points there). Serving identical content at "/" too created duplicate content
// with no canonical. Permanently redirect "/" → "/home" (HTTP 308) so there is a
// single indexable homepage URL and link equity consolidates.
export default function RootPage() {
  permanentRedirect("/home");
}
