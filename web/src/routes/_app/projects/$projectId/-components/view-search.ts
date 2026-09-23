import { z } from "zod";
import type { ProjectTaskPriority } from "@/api";
import type { DueBucket } from "@/lib/due-dates";
import {
  DEFAULT_TOOLBAR_STATE,
  type GroupByField,
  type SortField,
  type ToolbarState,
} from "./toolbar-filters";

export type BoardView = "board" | "table";

/**
 * The board's whole state, in the URL.
 *
 * Every field carries both a `default` and a `catch`: the default keeps each param optional, so
 * a plain `/projects/1` still lands on an unfiltered board, and the catch means a hand-edited or
 * outdated link degrades to that default rather than throwing a loader error at whoever was sent
 * it. That matters more than it did for a lone `view=` param, because a *saved* view arrives
 * through this same schema — including one written by a build that had filters this one does not.
 */
export const boardSearchSchema = z.object({
  view: z.enum(["board", "table"]).default("board").catch("board"),
  q: z.string().default("").catch(""),
  priority: z
    .array(z.enum(["URGENT", "HIGH", "MEDIUM", "LOW"]))
    .default([])
    .catch([]),
  due: z
    .array(z.enum(["overdue", "today", "week"]))
    .default([])
    .catch([]),
  assignee: z.array(z.string()).default([]).catch([]),
  sort: z
    .enum(["priority", "dueDate", "createdAt", "score", "name"])
    .nullable()
    .default(null)
    .catch(null),
  group: z
    .enum(["column", "priority", "assignee", "dueDate", "section"])
    .default("column")
    .catch("column"),
});

export type BoardSearch = z.infer<typeof boardSearchSchema>;

/**
 * The defaults as a value, for the route's `stripSearchParams` middleware.
 *
 * Derived from the schema rather than written out again, because the two must agree: the
 * middleware drops a param only when it deep-equals the default, so a list that drifted would
 * quietly stop stripping the field it no longer matches.
 */
export const BOARD_SEARCH_DEFAULTS: BoardSearch = boardSearchSchema.parse({});

/** The toolbar reads sets; the URL carries arrays. This is the only place that converts. */
export function toolbarStateFromSearch(search: BoardSearch): ToolbarState {
  return {
    search: search.q,
    priorities: new Set<ProjectTaskPriority>(search.priority),
    dueBuckets: new Set<DueBucket>(search.due),
    assigneeIds: new Set(search.assignee),
    sort: search.sort as SortField | null,
    groupBy: search.group as GroupByField,
  };
}

/**
 * The reverse, with defaults dropped.
 *
 * Omitting them keeps an unfiltered board at a bare `/projects/1` rather than a line of empty
 * params, and it is also what makes two routes to the same view produce the same object — which
 * is what {@link canonicalizeView} then rests on.
 *
 * **Arrays are sorted.** A set has no order, so picking Urgent then High has to come out equal to
 * picking High then Urgent; without it the toolbar would fail to recognise the very view that was
 * just applied. Keys are written in a fixed order for the same reason — `JSON.stringify` follows
 * insertion order, so this function's field order *is* the canonical one.
 */
export function searchFromToolbarState(
  state: ToolbarState,
  view: BoardView,
): Partial<BoardSearch> {
  const search: Partial<BoardSearch> = {};

  if (view !== "board") search.view = view;
  if (state.search.trim()) search.q = state.search;
  if (state.priorities.size) search.priority = [...state.priorities].sort();
  if (state.dueBuckets.size) search.due = [...state.dueBuckets].sort();
  if (state.assigneeIds.size) search.assignee = [...state.assigneeIds].sort();
  if (state.sort) search.sort = state.sort;
  if (state.groupBy !== DEFAULT_TOOLBAR_STATE.groupBy) {
    search.group = state.groupBy;
  }

  return search;
}

/**
 * What a saved view stores: its params as JSON, not as a query string.
 *
 * The obvious alternative is to store the URL's query string, since the point of the feature is
 * that a view *is* its link. It is the wrong one: how those params are encoded into a URL is
 * TanStack Router's business — today arrays go in JSON-encoded, and a router upgrade is entitled
 * to change that. Storing the encoding would mean every view saved before such a change decodes
 * to something else afterwards. What a view means has to outlive how a URL spells it, and both
 * forms are read back through the same schema either way, so nothing is lost by keeping the
 * stored form independent.
 */
export function serializeView(state: ToolbarState, view: BoardView): string {
  return JSON.stringify(searchFromToolbarState(state, view));
}

/**
 * Parse a stored view back into validated params.
 *
 * Unparseable JSON falls back to an unfiltered board rather than throwing: this runs while
 * rendering a menu of saved views, and one bad row must not take the board down with it. The
 * schema's `catch`es cannot cover this — they apply to a value that parsed, and a truncated
 * string never gets that far.
 */
export function deserializeView(stored: string): BoardSearch {
  try {
    return boardSearchSchema.parse(JSON.parse(stored));
  } catch {
    return boardSearchSchema.parse({});
  }
}

/** A stored view as the params to navigate to — defaults dropped, exactly as the toolbar writes. */
export function viewSearchParams(stored: string): Partial<BoardSearch> {
  const parsed = deserializeView(stored);
  return searchFromToolbarState(toolbarStateFromSearch(parsed), parsed.view);
}

/**
 * A stored view reduced to its meaning, so the toolbar can tell which one is on screen.
 *
 * Comparing raw strings would not do: a view saved before a filter existed, one whose arrays were
 * written in another order, and one carrying an explicit `view: "board"` all describe the same
 * board. Round-tripping both sides through the schema collapses every one of those.
 *
 * Note that {@link serializeView} already emits this form, so what the toolbar holds needs no
 * second pass — only the stored side does.
 */
export function canonicalizeView(stored: string): string {
  return JSON.stringify(viewSearchParams(stored));
}
