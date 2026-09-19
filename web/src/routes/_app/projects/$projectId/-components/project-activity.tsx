import {
  IconArrowRight,
  IconCheck,
  IconMessage,
  IconPlus,
  IconRotate,
  IconTrash,
  IconUserMinus,
  IconUserPlus,
  IconUserShield,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import type { ReactNode } from "react";
import type { ActivityEntry, ActivityKind } from "@/api";
import { listProjectActivityOptions } from "@/api/@tanstack/react-query.gen";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { getInitials } from "@/lib/utils";

const ICONS: Record<ActivityKind, typeof IconPlus> = {
  TASK_CREATED: IconPlus,
  TASK_MOVED: IconArrowRight,
  TASK_COMPLETED: IconCheck,
  TASK_DELETED: IconTrash,
  TASK_RESTORED: IconRotate,
  COMMENT_ADDED: IconMessage,
  MEMBER_ADDED: IconUserPlus,
  MEMBER_REMOVED: IconUserMinus,
  MEMBER_ROLE_CHANGED: IconUserShield,
};

function Subject({ children }: { children: ReactNode }) {
  return <span className="font-medium text-foreground">{children}</span>;
}

/**
 * The sentence for one entry.
 *
 * Phrasing only — every fact it reads was resolved when the event was written, so nothing here
 * can disagree with what actually happened. The one judgement it makes is "removed" vs "left",
 * which is the same row seen from a different angle: the actor being the subject *is* the
 * difference, and recording two kinds for it would put that decision in the database forever.
 */
function describe(entry: ActivityEntry): ReactNode {
  const subject = <Subject>{entry.subject}</Subject>;

  switch (entry.kind) {
    case "TASK_CREATED":
      return <>created {subject}</>;
    case "TASK_MOVED":
      return (
        <>
          moved {subject} from <Subject>{entry.fromLabel}</Subject> to{" "}
          <Subject>{entry.toLabel}</Subject>
        </>
      );
    case "TASK_COMPLETED":
      return <>completed {subject}</>;
    case "TASK_DELETED":
      return <>deleted {subject}</>;
    case "TASK_RESTORED":
      return <>restored {subject}</>;
    case "COMMENT_ADDED":
      return <>commented on {subject}</>;
    case "MEMBER_ADDED":
      return (
        <>
          joined as <Subject>{entry.toLabel}</Subject>
        </>
      );
    case "MEMBER_REMOVED":
      return entry.subject === entry.actorName ? (
        <>left the project</>
      ) : (
        <>removed {subject}</>
      );
    case "MEMBER_ROLE_CHANGED":
      return (
        <>
          changed {subject} from <Subject>{entry.fromLabel}</Subject> to{" "}
          <Subject>{entry.toLabel}</Subject>
        </>
      );
  }
}

export function ProjectActivity({ projectId }: { projectId: number }) {
  const { data: entries, isLoading } = useQuery(
    listProjectActivityOptions({ path: { projectId } }),
  );

  if (isLoading) return <Spinner className="size-4" />;

  if (!entries?.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing has happened in this project yet.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {entries.map((entry) => {
        const Icon = ICONS[entry.kind];

        return (
          <li key={String(entry.id)} className="flex gap-3">
            <Avatar className="size-7 shrink-0">
              <AvatarFallback className="text-[11px]">
                {getInitials(entry.actorName)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-sm leading-snug">
                <span className="font-medium">{entry.actorName}</span>{" "}
                <span className="text-muted-foreground">{describe(entry)}</span>
              </p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className="size-3" />
                {formatDistanceToNow(new Date(entry.createdAt), {
                  addSuffix: true,
                })}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
