import {
  Activity,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Droplets,
  Flame,
  HandHeart,
  HeartHandshake,
  Home,
  ShieldCheck,
  Sparkles,
  Users,
  WandSparkles,
} from "lucide-react";

const icons = {
  Activity,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Droplets,
  Flame,
  HandHeart,
  HeartHandshake,
  Home,
  ShieldCheck,
  Sparkles,
  Users,
  WandSparkles,
} as const;

interface PackageIconProps {
  name: string;
  className?: string;
  size?: number;
}

export function PackageIcon({ name, className, size = 22 }: PackageIconProps) {
  const Icon = icons[name as keyof typeof icons] ?? CheckCircle2;

  return <Icon aria-hidden="true" className={className} size={size} strokeWidth={2} />;
}
