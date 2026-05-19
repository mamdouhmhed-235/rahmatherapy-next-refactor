import { AlertTriangle } from "lucide-react";

export function MaintenanceBanner() {
  return (
    <div
      role="alert"
      className="w-full border-b-2 border-rahma-gold bg-[#fff8ec] px-4 py-3 text-center"
    >
      <p className="inline-flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-sm font-semibold leading-relaxed text-rahma-charcoal">
        <AlertTriangle className="size-4 shrink-0 text-rahma-gold" aria-hidden />
        <span>This website is still being built — online booking is not yet available.</span>
        <span className="font-normal text-rahma-muted">To get in touch:</span>
        <a
          href="tel:07798897222"
          className="font-bold text-rahma-green underline underline-offset-2 transition-opacity hover:opacity-75"
        >
          07798 897222
        </a>
        <span className="text-rahma-muted font-normal">(call, text, or WhatsApp)</span>
        <span className="text-rahma-muted font-normal">·</span>
        <a
          href="mailto:rahmatherapy@outlook.com"
          className="font-bold text-rahma-green underline underline-offset-2 transition-opacity hover:opacity-75"
        >
          rahmatherapy@outlook.com
        </a>
      </p>
    </div>
  );
}
