import { IconCloudOff } from "@tabler/icons-react";
import { useOnlineStatus } from "@/hooks/use-offline";

/**
 * Says plainly which of the two states the app is in.
 *
 * Without this, offline reads are worse than no offline support: the board opens from cache and
 * looks live, edits fail with a generic error, and nothing connects the two. A page that serves
 * stale data silently is the failure mode this feature would otherwise introduce.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <div className="flex items-center justify-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-700 dark:text-amber-400">
      <IconCloudOff className="size-3.5 shrink-0" />
      <span>
        You're offline. This is the last version that loaded — changes can't be
        saved until you're back.
      </span>
    </div>
  );
}
