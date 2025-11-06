import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";

interface CharacterCounterProps {
  current: number;
  min?: number;
  max?: number;
  optimal?: { min: number; max: number };
  label?: string;
}

export function CharacterCounter({
  current,
  min,
  max,
  optimal,
  label = "Zeichen",
}: CharacterCounterProps) {
  // Determine status
  let status: "optimal" | "acceptable" | "warning" = "acceptable";
  let icon = <AlertCircle className="h-3 w-3" />;
  let variant: "default" | "secondary" | "destructive" = "secondary";

  if (optimal) {
    if (current >= optimal.min && current <= optimal.max) {
      status = "optimal";
      icon = <CheckCircle2 className="h-3 w-3" />;
      variant = "default";
    } else if (
      (min && current < min) ||
      (max && current > max)
    ) {
      status = "warning";
      icon = <XCircle className="h-3 w-3" />;
      variant = "destructive";
    }
  } else {
    // Fallback without optimal range
    if (min && current < min) {
      status = "warning";
      icon = <XCircle className="h-3 w-3" />;
      variant = "destructive";
    } else if (max && current > max) {
      status = "warning";
      icon = <XCircle className="h-3 w-3" />;
      variant = "destructive";
    } else {
      status = "optimal";
      icon = <CheckCircle2 className="h-3 w-3" />;
      variant = "default";
    }
  }

  // Build display text
  let displayText = `${current} ${label}`;
  if (optimal) {
    displayText += ` (${optimal.min}-${optimal.max} optimal)`;
  } else if (min || max) {
    if (min && max) {
      displayText += ` (${min}-${max})`;
    } else if (max) {
      displayText += ` (max ${max})`;
    } else if (min) {
      displayText += ` (min ${min})`;
    }
  }

  return (
    <Badge
      variant={variant}
      className="gap-1 font-normal"
    >
      {icon}
      {displayText}
    </Badge>
  );
}
