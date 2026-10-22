import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ProgramBadgeProps {
  program: string;
  className?: string;
}

const TIER_TONES: Array<{ match: string; tone: string }> = [
  { match: "Starter", tone: "bg-muted text-muted-foreground" },
  { match: "Explorer", tone: "bg-sky-500/10 text-sky-700 dark:text-sky-400" },
  { match: "Artist", tone: "bg-violet-500/10 text-violet-700 dark:text-violet-400" },
  { match: "Master", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  { match: "Prestige", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
];

export function ProgramBadge({ program, className }: ProgramBadgeProps) {
  if (program === "-" || program === "") {
    return <span className="text-xs text-muted-foreground">-</span>;
  }

  const tone = TIER_TONES.find(({ match }) => program.includes(match))?.tone ?? "bg-muted text-muted-foreground";

  return (
    <Badge variant="outline" className={cn("border-transparent font-medium whitespace-nowrap", tone, className)}>
      {program}
    </Badge>
  );
}
