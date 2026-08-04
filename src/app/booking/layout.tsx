import { GoogleAnalytics } from "@/components/GoogleAnalytics";

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <GoogleAnalytics />
    </>
  );
}
