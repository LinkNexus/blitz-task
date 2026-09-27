import { IconCheck, IconCopy, IconRss, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  createCalendarFeedMutation,
  deleteCalendarFeedMutation,
  getCalendarFeedOptions,
  getCalendarFeedQueryKey,
} from "@/api/@tanstack/react-query.gen";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

/**
 * Appends the browser's own timezone to the feed URL.
 *
 * <b>This is the only place the zone is known.</b> A due date is an instant written by a date
 * picker — local midnight, with no time anyone chose — and the server stores no timezone beside
 * it, so publishing the UTC date would put every deadline a day early for anyone east of UTC.
 * The browser can simply answer the question, so it does, and the answer travels in the URL that
 * gets pasted into the calendar app.
 */
function withTimeZone(url: string): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone ? `${url}?tz=${encodeURIComponent(zone)}` : url;
  } catch {
    // An environment without a resolvable zone still gets a working feed, in UTC.
    return url;
  }
}

export function SubscribeDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const queryKey = getCalendarFeedQueryKey();

  // Not a suspense query and not in the route loader: subscribing is a side door off the
  // calendar, so this failing has to cost the dialog rather than the page.
  const { data, isLoading } = useQuery({
    ...getCalendarFeedOptions(),
    enabled: open,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey });

  const create = useMutation({
    ...createCalendarFeedMutation(),
    onSuccess: () => refresh(),
    onError: () => toast.error("Couldn't create the subscription link"),
  });

  const remove = useMutation({
    ...deleteCalendarFeedMutation(),
    onSuccess: () => {
      refresh();
      toast.success("Subscription revoked");
    },
    onError: () => toast.error("Couldn't revoke the subscription"),
  });

  const url = data?.url ? withTimeZone(data.url) : null;

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is refused in plenty of ordinary situations (an insecure origin, a
      // permission prompt declined). The URL is on screen and selectable either way.
      toast.error("Couldn't copy — select the link and copy it manually");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <IconRss className="size-3.5" />
          <span className="hidden sm:inline">Subscribe</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Subscribe from another calendar</DialogTitle>
          <DialogDescription>
            A link any calendar app understands — Google, Apple, Outlook. Your
            deadlines appear there as all-day events.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Spinner className="size-5" />
            </div>
          ) : url ? (
            <>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copy}
                  title="Copy link"
                  className="shrink-0"
                >
                  {copied ? (
                    <IconCheck className="size-4" />
                  ) : (
                    <IconCopy className="size-4" />
                  )}
                </Button>
              </div>

              {/* The single most important sentence in this dialog. A subscribed calendar is
                  polled on the other service's schedule — Google's is often hours — so someone
                  who reads this as sync will think the app is broken the first time a change
                  does not appear. */}
              <p className="text-xs text-muted-foreground">
                Anyone with this link can see your deadlines, so keep it
                private. Calendar apps refresh on their own schedule — often
                every few hours — so changes here take a while to show up there.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              You don't have a subscription link yet.
            </p>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          {url ? (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate({})}
            >
              <IconTrash className="size-3.5" />
              Revoke
            </Button>
          ) : (
            <span />
          )}

          <Button
            size="sm"
            disabled={create.isPending}
            onClick={() => create.mutate({})}
          >
            {create.isPending && <Spinner className="size-4" />}
            {/* Creating and rotating are the same request, and the label has to make the
                consequence obvious: there is no way to revoke a URL already handed to Google
                other than replacing it. */}
            {url ? "Generate a new link" : "Create a link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
