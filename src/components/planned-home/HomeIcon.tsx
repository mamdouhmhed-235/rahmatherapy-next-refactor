import {
  Award,
  ClipboardCheck,
  Home,
  MessageCircle,
  ShieldCheck,
  Users,
} from "lucide-react";

const icons = {
  Award,
  ClipboardCheck,
  Home,
  MessageCircle,
  ShieldCheck,
  Users,
} as const;

export type HomeIconName = keyof typeof icons;

interface HomeIconProps {
  name: string;
  className?: string;
}

export function HomeIcon({ name, className }: HomeIconProps) {
  const Icon = icons[name as HomeIconName] ?? ShieldCheck;

  return <Icon aria-hidden="true" className={className} size={22} strokeWidth={2} />;
}
