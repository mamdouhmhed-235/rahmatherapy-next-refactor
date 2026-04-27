import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Droplets,
  Flame,
  HandHeart,
  HeartHandshake,
  HelpCircle,
  Home,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
} from "lucide-react";

const icons = {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Droplets,
  Flame,
  HandHeart,
  HeartHandshake,
  HelpCircle,
  Home,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
} as const;

interface FaqsAftercareIconProps {
  name: string;
  className?: string;
  size?: number;
}

export function FaqsAftercareIcon({
  name,
  className,
  size = 22,
}: FaqsAftercareIconProps) {
  const Icon = icons[name as keyof typeof icons] ?? HelpCircle;

  return <Icon aria-hidden="true" className={className} size={size} strokeWidth={2} />;
}
