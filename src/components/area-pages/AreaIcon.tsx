import {
  Activity,
  BadgeCheck,
  CalendarDays,
  Car,
  CheckCircle2,
  Clock3,
  DoorOpen,
  Droplets,
  Dumbbell,
  HandHeart,
  HeartHandshake,
  Home,
  MapPin,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

const icons = {
  Activity,
  BadgeCheck,
  CalendarDays,
  Car,
  CheckCircle2,
  Clock3,
  DoorOpen,
  Droplets,
  Dumbbell,
  HandHeart,
  HeartHandshake,
  Home,
  MapPin,
  ShieldCheck,
  Sparkles,
  Users,
} as const;

export type AreaIconName = keyof typeof icons;

interface AreaIconProps {
  name: string;
  className?: string;
  size?: number;
}

export function AreaIcon({ name, className, size = 22 }: AreaIconProps) {
  const Icon = icons[name as AreaIconName] ?? CheckCircle2;

  return <Icon aria-hidden="true" className={className} size={size} strokeWidth={2} />;
}
