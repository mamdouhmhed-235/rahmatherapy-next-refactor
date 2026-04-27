import {
  Activity,
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
} from "lucide-react";

const icons = {
  Activity,
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
} as const;

interface ServicesIconProps {
  name: string;
  className?: string;
  size?: number;
}

export function ServicesIcon({ name, className, size = 22 }: ServicesIconProps) {
  const Icon = icons[name as keyof typeof icons] ?? ShieldCheck;

  return <Icon aria-hidden="true" className={className} size={size} strokeWidth={2} />;
}
