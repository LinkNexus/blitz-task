import {
  IconAt,
  IconBell,
  IconMessage,
  IconUserPlus,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import type { NotificationDetails } from "@/api";
import {
  listNotificationsOptions,
  listNotificationsQueryKey,
  markNotificationReadMutation,
  markNotificationsReadMutation,
} from "@/api/@tanstack/react-query.gen";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Typed against the union rather than inferred, so adding a kind to the API fails the build here
// instead of rendering an undefined icon at runtime — which is exactly how this one was caught.
const ICONS: Record<NotificationDetails["kind"], typeof IconBell> = {
  TASK_ASSIGNED: IconUserPlus,
  TASK_COMMENTED: IconMessage,
  MENTIONED_IN_COMMENT: IconAt,
};

function sentence(n: NotificationDetails) {
  switch (n.kind) {
    case "TASK_ASSIGNED":
      return "assigned you";
    case "MENTIONED_IN_COMMENT":
      return "mentioned you on";
    default:
      return "commented on";
  }
}

function NotificationRow({
  notification,
  onFollow,
}: {
  notification: NotificationDetails;
  onFollow: () => void;
}) {
  const Icon = ICONS[notification.kind];

  const body = (
    <>
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          notification.isRead ? "text-muted-foreground" : "text-primary",
        )}
      />
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="block text-sm leading-snug">
          <span className="font-medium">{notification.actorName}</span>{" "}
          <span className="text-muted-foreground">
            {sentence(notification)}
          </span>{" "}
          <span className="font-medium">{notification.taskName}</span>
        </span>
        <span className="block text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(notification.createdAt), {
            addSuffix: true,
          })}
        </span>
      </span>
    </>
  );

  const className = cn(
    "flex w-full gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted",
    !notification.isRead && "bg-primary/5",
  );

  // A notification whose task has been purged has nowhere to go — the row still says what
  // happened, because that remains true, but it must not offer a link to nothing.
  if (notification.taskId === null) {
    return <div className={cn(className, "cursor-default")}>{body}</div>;
  }

  // The task itself, not its board: being told you were mentioned and then handed a column of
  // cards to search through is the gap L35.5 closed.
  return (
    <Link
      to="/tasks/$taskId"
      params={{ taskId: String(notification.taskId) }}
      className={className}
      onClick={onFollow}
    >
      {body}
    </Link>
  );
}

/**
 * The bell.
 *
 * Lives in the `_app` layout, which never unmounts — so unlike a route component it will not
 * refetch on navigation, and every mutation that could change the count has to say so. That is
 * the same trap `invalidateProjectLists` exists for on the sidebar.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    ...listNotificationsOptions(),
    // The count is stale the moment someone else acts, and nothing in this tab can know that
    // until L33 pushes it. A minute is often enough to feel live without polling in earnest.
    refetchInterval: 60_000,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: listNotificationsQueryKey() });

  const markAll = useMutation({
    ...markNotificationsReadMutation(),
    onSuccess: invalidate,
  });

  const markOne = useMutation({
    ...markNotificationReadMutation(),
    onSuccess: invalidate,
  });

  // Ints arrive as `number | string` from the generated client, as everywhere else.
  const unread = Number(data?.unreadCount ?? 0);
  const items = data?.items ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative size-8 p-0"
          aria-label={
            unread > 0 ? `${unread} unread notifications` : "Notifications"
          }
        >
          <IconBell className="size-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium leading-4 text-primary-foreground tabular-nums">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
          {unread > 0 && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => markAll.mutate({})}
            >
              Mark all read
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Nothing yet.
          </p>
        ) : (
          <ul className="max-h-96 overflow-y-auto p-1">
            {items.map((notification) => (
              <li key={String(notification.id)}>
                <NotificationRow
                  notification={notification}
                  onFollow={() => {
                    setOpen(false);
                    // Following a notification is reading it — asking the user to also dismiss
                    // it is asking them to do the same thing twice.
                    if (!notification.isRead) {
                      markOne.mutate({
                        path: { notificationId: Number(notification.id) },
                      });
                    }
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
