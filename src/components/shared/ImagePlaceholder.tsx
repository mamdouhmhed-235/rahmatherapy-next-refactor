import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type PlaceholderRatio = "wide" | "video" | "square" | "portrait" | "tall";

const ratioClasses: Record<PlaceholderRatio, string> = {
  wide: "aspect-[21/10]",
  video: "aspect-video",
  square: "aspect-square",
  portrait: "aspect-[4/5]",
  tall: "aspect-[3/4]",
};

export interface ImagePlaceholderProps extends HTMLAttributes<HTMLDivElement> {
  filePath: string;
  imageType: string;
  ratio?: PlaceholderRatio;
  label?: string;
}

export function ImagePlaceholder({
  filePath,
  imageType,
  ratio = "video",
  label,
  className,
  ...props
}: ImagePlaceholderProps) {
  const visibleLabel = label ?? `PLACEHOLDER IMAGE: ${imageType}`;

  return (
    <div
      role="img"
      aria-label={`${visibleLabel}. Intended file: ${filePath}`}
      className={cn(
        "relative flex min-h-56 w-full overflow-hidden rounded-3xl border border-dashed border-rahma-border bg-[#fffaf2]",
        ratioClasses[ratio],
        className
      )}
      {...props}
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(48,70,63,0.08)_25%,transparent_25%,transparent_50%,rgba(48,70,63,0.08)_50%,rgba(48,70,63,0.08)_75%,transparent_75%,transparent)] bg-[length:28px_28px]" />
      <div className="relative z-10 m-auto flex max-w-sm flex-col items-center gap-3 px-6 text-center">
        <span className="rounded-full bg-rahma-green px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white">
          Placeholder
        </span>
        <p className="text-lg font-semibold text-rahma-charcoal">{visibleLabel}</p>
        <p className="text-sm leading-6 text-rahma-muted">{filePath}</p>
      </div>
    </div>
  );
}
