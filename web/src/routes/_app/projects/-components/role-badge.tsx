import type { ProjectRole } from "@/api";
import { Badge } from "@/components/ui/badge";

type RoleBadgeVariant = "default" | "secondary" | "outline" | "destructive";

const ROLE_BADGE_VARIANT: Record<ProjectRole, RoleBadgeVariant> = {
  Owner: "default",
  Collaborator: "secondary",
  Contributor: "outline",
  Viewer: "outline",
};

/**
 * Tokens throughout, which is what removes the `dark:` variant this used to carry: `text-blue-600
 * dark:text-blue-400` is `--info` spelled by hand, one lightness per mode, and the token already
 * holds both — so a theme change moves these and a hand-written pair would not.
 */
const ROLE_BADGE_CLASS: Record<ProjectRole, string> = {
  Owner: "",
  Collaborator: "border-info/30 bg-info/10 text-info",
  Contributor: "border-success/30 bg-success/10 text-success",
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
