import {
  IconUserMinus,
  IconUserPlus,
  IconUsers,
} from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";
import type { CurrentUser, ProjectDetails, ProjectParticipantInfo, ProjectRole } from "@/api";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getInitials } from "@/lib/utils";

// ─── Role constants ───────────────────────────────────────────────────────────

const ROLE_LABELS: Record<number, string> = {
  0: "Owner",
  1: "Admin",
  2: "Contributor",
  3: "Viewer",
};

type RoleBadgeVariant = "default" | "secondary" | "outline" | "destructive";

const ROLE_BADGE_VARIANT: Record<number, RoleBadgeVariant> = {
  0: "default",
  1: "secondary",
  2: "outline",
  3: "outline",
};

const ROLE_BADGE_CLASS: Record<number, string> = {
  0: "",
  1: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  2: "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400",
  3: "",
};

// Roles that can be assigned (anyone can become Admin, Contributor or Viewer — not Owner)
const ALL_ASSIGNABLE_ROLES = [
  { value: "1", label: "Admin" },
  { value: "2", label: "Contributor" },
  { value: "3", label: "Viewer" },
] as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: ProjectRole }) {
  const label = ROLE_LABELS[role as number] ?? "Unknown";
  return (
    <Badge
      variant={ROLE_BADGE_VARIANT[role as number] ?? "outline"}
      className={ROLE_BADGE_CLASS[role as number]}
    >
      {label}
    </Badge>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  project: ProjectDetails;
  currentUser: CurrentUser;
};

export function ProjectMembersSection({ project, currentUser }: Props) {
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<string>("2");
  const [isAdding, setIsAdding] = useState(false);

  const currentParticipant = project.participants.find(
    (p) => String(p.userId) === String(currentUser.id),
  );
  const currentUserRole = currentParticipant?.role as number | undefined;
  const isOwner = currentUserRole === 0;
  const isAdmin = currentUserRole === 1;
  const canManage = isOwner || isAdmin;

  // Admins can't promote to Admin (only Owners can)
  const assignableRoles = isOwner
    ? ALL_ASSIGNABLE_ROLES
    : ALL_ASSIGNABLE_ROLES.filter((r) => r.value !== "1");

  const canManageMember = (p: ProjectParticipantInfo): boolean => {
    if (!canManage) return false;
    if ((p.role as number) === 0) return false; // Never touch the Owner
    if (String(p.userId) === String(currentUser.id)) return false; // Not yourself
    if (!isOwner && (p.role as number) === 1) return false; // Admin can't manage other Admins
    return true;
  };

  const handleAddMember = async () => {
    if (!addEmail.trim()) return;
    setIsAdding(true);
    try {
      // TODO: wire to POST /api/projects/{projectId}/members
      toast.info("Member management coming soon");
      setAddEmail("");
      setAddRole("2");
    } finally {
      setIsAdding(false);
    }
  };

  const handleChangeRole = (_userId: number | string, _newRole: string) => {
    // TODO: wire to PUT /api/projects/{projectId}/members/{userId}
    toast.info("Member management coming soon");
  };

  const handleRemoveMember = (_userId: number | string) => {
    // TODO: wire to DELETE /api/projects/{projectId}/members/{userId}
    toast.info("Member management coming soon");
  };

  return (
    <div className="space-y-4">
      {/* Section heading */}
      <div className="flex items-center gap-2">
        <IconUsers className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">
          Members
          <span className="ml-1.5 text-muted-foreground font-normal">
            ({project.participants.length})
          </span>
        </h3>
      </div>

      {/* Add member form */}
      {canManage && (
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="Email address"
            value={addEmail}
            onChange={(e) => setAddEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddMember();
              }
            }}
            className="flex-1"
          />
          <Select value={addRole} onValueChange={setAddRole}>
            <SelectTrigger className="w-34 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {assignableRoles.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            disabled={!addEmail.trim() || isAdding}
            onClick={handleAddMember}
            className="shrink-0"
          >
            <IconUserPlus className="size-4" />
            Add
          </Button>
        </div>
      )}

      {/* Member list */}
      <ul className="space-y-2">
        {project.participants.map((p) => {
          const isSelf = String(p.userId) === String(currentUser.id);
          const manageable = canManageMember(p);

          return (
            <li
              key={String(p.userId)}
              className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5"
            >
              {/* Avatar */}
              <Avatar className="size-8 shrink-0">
                <AvatarFallback className="text-xs">
                  {getInitials(p.name)}
                </AvatarFallback>
              </Avatar>

              {/* Name */}
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{p.name}</span>
                {isSelf && (
                  <span className="text-xs text-muted-foreground">You</span>
                )}
              </div>

              {/* Role — editable Select for manageable members, static Badge otherwise */}
              {manageable ? (
                <Select
                  value={String(p.role)}
                  onValueChange={(v) => handleChangeRole(p.userId, v)}
                >
                  <SelectTrigger className="h-7 w-30 shrink-0 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableRoles.map((r) => (
                      <SelectItem key={r.value} value={r.value} className="text-xs">
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <RoleBadge role={p.role} />
              )}

              {/* Remove button */}
              {manageable ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${p.name}`}
                  onClick={() => handleRemoveMember(p.userId)}
                >
                  <IconUserMinus className="size-4" />
                </Button>
              ) : (
                // Keep a ghost slot so rows stay the same width
                <div className="size-7 shrink-0" />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
