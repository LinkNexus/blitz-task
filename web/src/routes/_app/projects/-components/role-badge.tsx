import type { ProjectRole } from "@/api";
import { Badge } from "@/components/ui/badge";

type RoleBadgeVariant = "default" | "secondary" | "outline" | "destructive";

const ROLE_BADGE_VARIANT: Record<ProjectRole, RoleBadgeVariant> = {
  Owner: "default",
  Collaborator: "secondary",
  Contributor: "outline",
  Viewer: "outline",
};

const ROLE_BADGE_CLASS: Record<ProjectRole, string> = {
  Owner: "",
  Collaborator:
    "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  Contributor:
    "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400",
  Viewer: "",
};

export function RoleBadge({ role }: { role: ProjectRole }) {
  return (
    <Badge
      variant={ROLE_BADGE_VARIANT[role]}
      className={ROLE_BADGE_CLASS[role]}
    >
      {role}
    </Badge>
  );
}
