import {
  Award,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  HeartHandshake,
  Home,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

const icons = {
  Award,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  HeartHandshake,
  Home,
  ShieldCheck,
  Sparkles,
  Users,
} as const;

interface AboutIconProps {
  name: string;
  className?: string;
  size?: number;
}

export function AboutIcon({ name, className, size = 22 }: AboutIconProps) {
  const Icon = icons[name as keyof typeof icons] ?? ShieldCheck;

  return <Icon aria-hidden="true" className={className} size={size} strokeWidth={2} />;
}
