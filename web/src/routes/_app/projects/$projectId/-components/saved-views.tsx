import {
  IconBookmark,
  IconCheck,
  IconChevronDown,
  IconDeviceFloppy,
  IconDots,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { SavedViewDetails } from "@/api";
import {
  createSavedViewMutation,
  deleteSavedViewMutation,
  listSavedViewsOptions,
  listSavedViewsQueryKey,
  updateSavedViewMutation,
} from "@/api/@tanstack/react-query.gen";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import type { ToolbarState } from "./toolbar-filters";
import {
  type BoardView,
  canonicalizeView,
  serializeView,
  viewSearchParams,
} from "./view-search";

type Props = {
  projectId: number;
  state: ToolbarState;
  view: BoardView;
};

/** Longest name the server will store — mirrored here so the input stops rather than 422s. */
const MAX_NAME_LENGTH = 60;

/** Which dialog is open, and what it is about to write. */
type Editing = { viewId: number | null; name: string };

export function SavedViews({ projectId, state, view }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Editing | null>(null);

  const path = { projectId };
  const queryKey = listSavedViewsQueryKey({ path });

  // Not a suspense query and not in the route loader: the views menu is a convenience beside
  // the board, so it failing has to cost the menu, not the page.
  const { data: views } = useQuery(listSavedViewsOptions({ path }));
  const savedViews = views ?? [];

  // What "save this" would store. `serializeView` already emits the canonical form, so only the
  // stored side of the comparison below needs putting through `canonicalizeView`.
  const currentSearch = useMemo(
    () => serializeView(state, view),
    [state, view],
  );

  const activeView = savedViews.find(
    (v) => canonicalizeView(v.search) === currentSearch,
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey });

  const createView = useMutation({
    ...createSavedViewMutation(),
    onSuccess: () => {
      refresh();
      toast.success("View saved");
      setEditing(null);
    },
    onError: (error) =>
      toast.error(
        "message" in error ? error.message : "Failed to save this view",
      ),
  });

  const updateView = useMutation({
    ...updateSavedViewMutation(),
    onSuccess: () => {
      refresh();
      setEditing(null);
    },
    onError: (error) =>
      toast.error("message" in error ? error.message : "Failed to save"),
  });

  const deleteView = useMutation({
    ...deleteSavedViewMutation(),
    onSuccess: () => {
      refresh();
      toast.success("View deleted");
    },
    onError: () => toast.error("Failed to delete this view"),
  });

  const applyView = (saved: SavedViewDetails) =>
    navigate({
      to: "/projects/$projectId",
      params: { projectId: String(projectId) },
      search: viewSearchParams(saved.search),
    });

  /** Point a view at the filters currently on screen, keeping its name. */
  const overwriteView = (saved: SavedViewDetails) =>
    updateView.mutate(
      {
        path: { projectId, viewId: Number(saved.id) },
        body: { name: saved.name, search: currentSearch },
      },
      { onSuccess: () => toast.success(`"${saved.name}" updated`) },
    );

  const submitDialog = () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return;

    if (editing.viewId === null) {
      createView.mutate({ path, body: { name, search: currentSearch } });
      return;
    }

    // A rename must not move the view onto the filters currently on screen — those are two
    // separate actions, and the menu offers both.
    const target = savedViews.find((v) => Number(v.id) === editing.viewId);
    updateView.mutate({
      path: { projectId, viewId: editing.viewId },
      body: { name, search: target?.search ?? currentSearch },
    });
  };

  const dialogPending = createView.isPending || updateView.isPending;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={activeView ? "secondary" : "ghost"}
            size="sm"
            className="h-8 gap-1.5 text-muted-foreground hover:text-foreground shrink-0 max-w-[180px]"
          >
            <IconBookmark className="size-3.5 shrink-0" />
            <span className="text-xs truncate">
              {activeView ? activeView.name : "Views"}
            </span>
            <IconChevronDown className="size-3 opacity-50 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Saved views
          </DropdownMenuLabel>

          {savedViews.length === 0 && (
            <p className="px-2 py-1.5 text-[11px] text-muted-foreground/70">
              Filter and sort the board, then save it here to come back to it.
            </p>
          )}

          {savedViews.map((saved) => (
            <div key={saved.id} className="flex items-center">
              <DropdownMenuItem
                className="flex-1 gap-2 min-w-0"
                onClick={() => applyView(saved)}
              >
                <IconCheck
                  className={`size-3.5 shrink-0 ${saved.id === activeView?.id ? "" : "invisible"}`}
                />
                <span className="truncate">{saved.name}</span>
              </DropdownMenuItem>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="px-1.5 [&>svg:last-child]:hidden">
                  <IconDots className="size-3.5" />
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    className="gap-2"
                    onClick={() =>
                      setEditing({
                        viewId: Number(saved.id),
                        name: saved.name,
                      })
                    }
                  >
                    <IconPencil className="size-3.5" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-2"
                    onClick={() => overwriteView(saved)}
                  >
                    <IconDeviceFloppy className="size-3.5" />
                    Save current filters here
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    className="gap-2"
                    onClick={() =>
                      deleteView.mutate({
                        path: { projectId, viewId: Number(saved.id) },
                      })
                    }
                  >
                    <IconTrash className="size-3.5" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </div>
          ))}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2"
            onClick={() => setEditing({ viewId: null, name: "" })}
          >
            <IconDeviceFloppy className="size-3.5" />
            Save current view…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editing?.viewId === null ? "Save this view" : "Rename view"}
            </DialogTitle>
            <DialogDescription>
              {editing?.viewId === null
                ? "Saves the filters, sort and layout currently on the board. Only you can see it."
                : "Renames the view. Its filters stay as they were saved."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="saved-view-name">Name</Label>
            <Input
              id="saved-view-name"
              value={editing?.name ?? ""}
              onChange={(e) =>
                setEditing((current) =>
                  current ? { ...current, name: e.target.value } : current,
                )
              }
              placeholder="My urgent work"
              maxLength={MAX_NAME_LENGTH}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !dialogPending) submitDialog();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              disabled={!editing?.name.trim() || dialogPending}
              onClick={submitDialog}
            >
              {dialogPending && <Spinner className="size-4" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
