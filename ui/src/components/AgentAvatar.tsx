import { useMemo } from "react";
import { cn } from "../lib/utils";

// Gradient color pairs — visually distinct, pleasant on light and dark backgrounds
const GRADIENT_PAIRS = [
  ["#6366f1", "#8b5cf6"], // indigo → violet
  ["#ec4899", "#f43f5e"], // pink → rose
  ["#14b8a6", "#06b6d4"], // teal → cyan
  ["#f97316", "#eab308"], // orange → yellow
  ["#3b82f6", "#6366f1"], // blue → indigo
  ["#8b5cf6", "#ec4899"], // violet → pink
  ["#10b981", "#14b8a6"], // emerald → teal
  ["#f43f5e", "#f97316"], // rose → orange
  ["#06b6d4", "#3b82f6"], // cyan → blue
  ["#eab308", "#10b981"], // yellow → emerald
  ["#a855f7", "#6366f1"], // purple → indigo
  ["#ef4444", "#ec4899"], // red → pink
] as const;

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  }
  return (name.trim().charAt(0) || "?").toUpperCase();
}

interface AgentAvatarProps {
  name: string;
  agentId?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  xs: "w-5 h-5 text-[9px]",
  sm: "w-6 h-6 text-[10px]",
  md: "w-8 h-8 text-xs",
  lg: "w-10 h-10 text-sm",
};

export function AgentAvatar({ name, agentId, size = "md", className }: AgentAvatarProps) {
  const { initials, gradientFrom, gradientTo, rotation } = useMemo(() => {
    const seed = agentId ?? name;
    const hash = hashString(seed);
    const pairIndex = hash % GRADIENT_PAIRS.length;
    const pair = GRADIENT_PAIRS[pairIndex]!;
    return {
      initials: getInitials(name),
      gradientFrom: pair[0],
      gradientTo: pair[1],
      rotation: (hash >> 8) % 360,
    };
  }, [name, agentId]);

  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-full font-semibold text-white shrink-0 select-none",
        sizeClasses[size],
        className,
      )}
      style={{
        background: `linear-gradient(${rotation}deg, ${gradientFrom}, ${gradientTo})`,
      }}
    >
      <span className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]">{initials}</span>
    </div>
  );
}
