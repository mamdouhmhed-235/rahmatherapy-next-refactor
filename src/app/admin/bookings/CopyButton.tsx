"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyButton({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  async function copyValue() {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  }

  return (
    <Button type="button" size="sm" variant="outline" onClick={copyValue}>
      <Copy className="size-4" />
      {label}
    </Button>
  );
}
