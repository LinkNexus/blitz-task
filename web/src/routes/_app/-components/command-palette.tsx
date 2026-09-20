import {
  IconCalendar,
  IconFolder,
  IconInbox,
  IconLayoutDashboard,
  IconMessage,
  IconPlus,
  IconSearch,
  IconSquareCheck,
  IconSun,
  IconTrash,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { searchOptions } from "@/api/@tanstack/react-query.gen";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { requestQuickCapture } from "./quick-capture";

/** Mirrors the server's floor, so the palette can explain the silence rather than look broken. */
const MIN_QUERY_LENGTH = 2;

/** Opens the palette from anywhere — the sidebar's Search entry, or any future affordance. */
export function requestCommandPalette() {
  document.dispatchEvent(new CustomEvent("command.palette"));
}

/** Typing a letter into a field must not open a dialog over what you were writing. */
function isTypingInto(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

type Item = {
  id: string;
  label: string;
  hint?: string;
  icon: typeof IconSearch;
  run: () => void;
};

type Group = { heading: string; items: Item[] };

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const onRequest = () => setOpen(true);
    const onKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+K is the one shortcut that must work *while* typing — it is how you leave
      // whatever you are in, so `isTypingInto` deliberately does not gate it.
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((wasOpen) => !wasOpen);
        return;
      }

      // "/" is the other half of the same habit, and that one does need the guard.
      if (
        e.key === "/" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !isTypingInto(e.target)
      ) {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener("command.palette", onRequest);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("command.palette", onRequest);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const term = query.trim();

  const { data: results, isFetching } = useQuery({
    ...searchOptions({ query: { q: term, limit: 5 } }),
    enabled: open && term.length >= MIN_QUERY_LENGTH,
  });

  /**
   * Where a palette entry can send you, spelled out rather than cast.
   *
   * The tempting shortcut is `to: string` and an `any`, and it costs exactly what it looks
   * like it saves: a typo in a route becomes a runtime dead end instead of a build error, in
   * the one component whose entire job is going places.
   */
  /**
   * Closing always resets, whichever way it happens.
   *
   * Radix only calls `onOpenChange` for dismissals *it* drives — Escape, a click outside — so
   * clearing there alone left the query behind whenever an entry was chosen, and the palette
   * reopened holding the last thing searched for. Escape and Enter disagreeing about that is
   * worse than either rule on its own.
   */
  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, []);

  const goTo = useCallback(
    (
      to:
        | "/dashboard"
        | "/today"
        | "/upcoming"
        | "/inbox"
        | "/calendar"
        | "/trash"
        | "/search",
    ) => {
      close();
      navigate({ to });
    },
    [close, navigate],
  );

  const goToProject = useCallback(
    (projectId: number | string) => {
      close();
      navigate({
        to: "/projects/$projectId",
        params: { projectId: String(projectId) },
      });
    },
    [close, navigate],
  );

  /**
   * A task result means the task, not the board it happens to sit on (L35.5) — and a *comment*
   * result means the remark, so it carries the anchor the search page uses.
   */
  const goToTask = useCallback(
    (taskId: number | string, commentId?: number | string) => {
      close();
      navigate({
        to: "/tasks/$taskId",
        params: { taskId: String(taskId) },
        search: commentId === undefined ? {} : { comment: Number(commentId) },
      });
    },
    [close, navigate],
  );

  const groups = useMemo<Group[]>(() => {
    const navigation: Item[] = [
      {
        id: "nav-dashboard",
        label: "Dashboard",
        icon: IconLayoutDashboard,
        run: () => goTo("/dashboard"),
      },
      {
        id: "nav-today",
        label: "Today",
        icon: IconSun,
        run: () => goTo("/today"),
      },
      {
        id: "nav-upcoming",
        label: "Upcoming",
        icon: IconCalendar,
        run: () => goTo("/upcoming"),
      },
      {
        id: "nav-inbox",
        label: "Inbox",
        icon: IconInbox,
        run: () => goTo("/inbox"),
      },
      {
        id: "nav-calendar",
        label: "Calendar",
        icon: IconCalendar,
        run: () => goTo("/calendar"),
      },
      {
        id: "nav-trash",
        label: "Trash",
        icon: IconTrash,
        run: () => goTo("/trash"),
      },
      {
        id: "action-capture",
        label: "New task",
        hint: "c",
        icon: IconPlus,
        run: () => {
          close();
          requestQuickCapture();
        },
      },
    ];

    // With nothing typed the palette is a menu, not a search box: the commands are the answer
    // to "what can I do from here", and showing them beats an empty panel.
    if (term.length < MIN_QUERY_LENGTH) {
      return [{ heading: "Go to", items: navigation }];
    }

    const matching = navigation.filter((item) =>
      item.label.toLowerCase().includes(term.toLowerCase()),
    );

    const built: Group[] = [];

    if (results?.tasks.length) {
      built.push({
        heading: "Tasks",
        items: results.tasks.map((task) => ({
          id: `task-${task.id}`,
          label: task.name,
          hint: task.isInbox
            ? "Inbox"
            : `${task.projectName} · ${task.columnName}`,
          icon: IconSquareCheck,
          run: () => goToTask(task.id),
        })),
      });
    }

    if (results?.projects.length) {
      built.push({
        heading: "Projects",
        items: results.projects.map((project) => ({
          id: `project-${project.id}`,
          label: project.name,
          icon: IconFolder,
          run: () => goToProject(project.id),
        })),
      });
    }

    if (results?.comments.length) {
      built.push({
        heading: "Comments",
        items: results.comments.map((comment) => ({
          id: `comment-${comment.id}`,
          label: comment.excerpt,
          hint: `${comment.authorName} on ${comment.taskName}`,
          icon: IconMessage,
          run: () => goToTask(comment.taskId, comment.id),
        })),
      });
    }

    if (matching.length) built.push({ heading: "Go to", items: matching });

    // The page still exists and is still the shareable form of a query, so the palette offers
    // it rather than pretending it does not — one keystroke away instead of the way in.
    built.push({
      heading: "Search",
      items: [
        {
          id: "see-all",
          label: `See all results for "${term}"`,
          icon: IconSearch,
          run: () => {
            close();
            navigate({ to: "/search", search: { q: term } });
          },
        },
      ],
    });

    return built;
  }, [term, results, navigate, close, goTo, goToProject, goToTask]);

  const flat = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
    >
      <DialogContent
        showCloseButton={false}
        className="top-[20%] max-w-xl translate-y-0 gap-0 overflow-hidden p-0"
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>

        <div className="flex items-center gap-2.5 border-b px-4">
          <IconSearch className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              // Typing changes what the list holds, so a highlight from the previous query
              // is not pointing at what the user is looking at.
              setActive(0);
            }}
            placeholder="Search tasks, projects and comments, or jump to a page…"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (flat.length === 0) return;

              switch (e.key) {
                case "ArrowDown":
                  e.preventDefault();
                  setActive((i) => (i + 1) % flat.length);
                  break;
                case "ArrowUp":
                  e.preventDefault();
                  setActive((i) => (i - 1 + flat.length) % flat.length);
                  break;
                case "Enter":
                  e.preventDefault();
                  flat[active]?.run();
                  break;
              }
            }}
          />
          {isFetching && <Spinner className="size-4 shrink-0" />}
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {flat.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              Nothing matches “{term}”.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.heading} className="mb-1 last:mb-0">
                <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {group.heading}
                </p>
                {group.items.map((item) => {
                  const index = flat.indexOf(item);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      // Mouse down rather than click: the input keeps focus, so a click would
                      // land after the dialog had already begun closing.
                      onMouseDown={(e) => {
                        e.preventDefault();
                        item.run();
                      }}
                      onMouseEnter={() => setActive(index)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm",
                        index === active ? "bg-accent" : "hover:bg-accent/60",
                      )}
                    >
                      <item.icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">
                        {item.label}
                      </span>
                      {item.hint && (
                        <span className="shrink-0 truncate text-xs text-muted-foreground">
                          {item.hint}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
