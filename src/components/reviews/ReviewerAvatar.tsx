import { cn } from "@/lib/utils";

interface ReviewerAvatarProps {
  name: string;
  className?: string;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  return initials || "RT";
}

export function ReviewerAvatar({ name, className }: ReviewerAvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-full bg-rahma-green text-sm font-semibold text-white ring-4 ring-rahma-ivory",
        className
      )}
    >
      {getInitials(name)}
    </span>
  );
}
