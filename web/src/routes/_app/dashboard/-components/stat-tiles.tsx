import {
  IconAlertTriangle,
  IconCalendarWeek,
  IconLayoutKanban,
  IconSun,
} from "@tabler/icons-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DashboardCounts } from "./task-buckets";

type Tile = {
  key: keyof DashboardCounts | "projects";
  label: string;
  icon: typeof IconSun;
  value: number;
  /** Applied only when the value is non-zero — a zero overdue count is good news, not an alarm. */
  accent?: string;
};

export function StatTiles({
  counts,
  projectCount,
}: {
  counts: DashboardCounts;
  projectCount: number;
}) {
  const tiles: Tile[] = [
    {
      key: "overdue",
      label: "Overdue",
      icon: IconAlertTriangle,
      value: counts.overdue,
      accent: "text-red-600 dark:text-red-400",
    },
    {
      key: "today",
      label: "Due today",
      icon: IconSun,
      value: counts.today,
      accent: "text-orange-600 dark:text-orange-400",
    },
    {
      key: "week",
      label: "This week",
      icon: IconCalendarWeek,
      value: counts.week,
    },
    {
      key: "projects",
      label: projectCount === 1 ? "Project" : "Projects",
      icon: IconLayoutKanban,
      value: projectCount,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map(({ key, label, icon: Icon, value, accent }) => (
        <Card key={key} className="p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{label}</span>
          </div>
          <p
            className={cn(
              "mt-2 text-2xl font-semibold tabular-nums",
              value > 0 && accent,
            )}
          >
            {value}
          </p>
        </Card>
      ))}
    </div>
  );
}
