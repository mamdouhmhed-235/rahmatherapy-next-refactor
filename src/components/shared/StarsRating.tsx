import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarsRatingProps {
  rating?: number;
  outOf?: number;
  label?: string;
  className?: string;
}

export function StarsRating({
  rating = 5,
  outOf = 5,
  label,
  className,
}: StarsRatingProps) {
  const safeOutOf = Math.max(1, Math.floor(outOf));
  const safeRating = Math.max(0, Math.min(rating, safeOutOf));
  const roundedRating = Math.round(safeRating);
  const ariaLabel = label ?? `${safeRating} out of ${safeOutOf} stars`;

  return (
    <div className={cn("inline-flex items-center gap-1 text-rahma-gold", className)}>
      <span className="sr-only">{ariaLabel}</span>
      {Array.from({ length: safeOutOf }, (_, index) => (
        <Star
          key={index}
          aria-hidden="true"
          size={18}
          strokeWidth={2.2}
          className={cn(index < roundedRating ? "fill-current" : "fill-transparent")}
        />
      ))}
    </div>
  );
}
