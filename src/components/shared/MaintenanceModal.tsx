"use client";

import { useEffect, useState } from "react";
import { Mail, Phone } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SESSION_KEY = "maintenance-modal-seen";

export function MaintenanceModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem(SESSION_KEY)) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setOpen(true);
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showCloseButton={false} className="bg-rahma-ivory">
        <DialogHeader>
          <DialogTitle className="text-rahma-green">
            We're adding the finishing touches
          </DialogTitle>
          <DialogDescription className="text-rahma-charcoal">
            Our website isn't quite ready yet — we're putting the last details in place.
            Please check back soon. In the meantime, we'd love to hear from you directly.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-rahma-border bg-white px-5 py-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-rahma-muted">
            Get in touch
          </p>
          <a
            href="tel:07798897222"
            className="flex items-start gap-3 text-rahma-green font-semibold hover:underline underline-offset-2"
          >
            <Phone className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              07798 897222{" "}
              <span className="font-normal text-rahma-muted text-sm">— call, text, or WhatsApp</span>
            </span>
          </a>
          <a
            href="mailto:rahmatherapy@outlook.com"
            className="flex items-center gap-3 text-rahma-green font-semibold hover:underline underline-offset-2"
          >
            <Mail className="size-4 shrink-0" aria-hidden />
            <span>rahmatherapy@outlook.com</span>
          </a>
        </div>

        <DialogClose className="w-full cursor-pointer rounded-lg bg-rahma-gold px-6 py-3 text-sm font-semibold text-rahma-charcoal transition-opacity duration-[var(--motion-duration-fast)] hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35">
          Got it — I'll check back soon
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
