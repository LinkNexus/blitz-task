import { describe, expect, test } from "bun:test";
import { DEFAULT_TOOLBAR_STATE, type ToolbarState } from "./toolbar-filters";
import {
  type BoardView,
  boardSearchSchema,
  canonicalizeView,
  deserializeView,
  searchFromToolbarState,
  serializeView,
  toolbarStateFromSearch,
} from "./view-search";

const state = (over: Partial<ToolbarState> = {}): ToolbarState => ({
  ...DEFAULT_TOOLBAR_STATE,
  ...over,
});

const roundTrip = (s: ToolbarState, view: BoardView = "board") =>
  toolbarStateFromSearch(deserializeView(serializeView(s, view)));

describe("boardSearchSchema", () => {
  test("an empty search is an unfiltered board", () => {
    expect(boardSearchSchema.parse({})).toEqual({
      view: "board",
      q: "",
      priority: [],
      due: [],
      assignee: [],
      sort: null,
      group: "column",
    });
  });

  test("a value it does not recognise falls back instead of throwing", () => {
    // Someone hand-editing a link, or a view saved by a build that had a filter this one
    // dropped. A loader error would be a blank page for a link the sender thought worked.
    const parsed = boardSearchSchema.parse({
      view: "gantt",
      sort: "vibes",
      group: "nonsense",
      priority: ["URGENT", "CRITICAL"],
    });

    expect(parsed.view).toBe("board");
    expect(parsed.sort).toBeNull();
    expect(parsed.group).toBe("column");
    // The catch is per field, so one bad member discards that array and leaves the rest alone.
    expect(parsed.priority).toEqual([]);
  });
});

describe("searchFromToolbarState", () => {
  test("drops every default, so an unfiltered board has an empty search", () => {
    expect(searchFromToolbarState(state(), "board")).toEqual({});
  });

  test("carries only what is actually set", () => {
    expect(
      searchFromToolbarState(
        state({ priorities: new Set(["URGENT"]), sort: "dueDate" }),
        "table",
      ),
    ).toEqual({ view: "table", priority: ["URGENT"], sort: "dueDate" });
  });

  test("a whitespace-only query is not a filter", () => {
    expect(searchFromToolbarState(state({ search: "   " }), "board")).toEqual(
      {},
    );
  });

  test("sorts sets, so the order they were picked in cannot matter", () => {
    const one = serializeView(
      state({ priorities: new Set(["HIGH", "URGENT"]) }),
      "board",
    );
    const other = serializeView(
      state({ priorities: new Set(["URGENT", "HIGH"]) }),
      "board",
    );

    expect(one).toBe(other);
  });
});

describe("round trip", () => {
  test("survives every field at once", () => {
    const original = state({
      search: "api call",
      priorities: new Set(["URGENT", "LOW"]),
      dueBuckets: new Set(["overdue", "today"]),
      assigneeIds: new Set(["7", "2"]),
      sort: "name",
      groupBy: "assignee",
    });

    const result = roundTrip(original, "table");

    expect(result).toEqual(original);
    expect(deserializeView(serializeView(original, "table")).view).toBe(
      "table",
    );
  });

  test("an unfiltered board comes back unfiltered", () => {
    expect(roundTrip(state())).toEqual(DEFAULT_TOOLBAR_STATE);
  });
});

describe("deserializeView", () => {
  test("a truncated or non-JSON value reads as an unfiltered board", () => {
    // This runs while rendering the menu of saved views. One unreadable row must not throw
    // and take the whole board down with it.
    expect(deserializeView('{"view":"tab')).toEqual(
      boardSearchSchema.parse({}),
    );
    expect(deserializeView("")).toEqual(boardSearchSchema.parse({}));
    expect(deserializeView("null")).toEqual(boardSearchSchema.parse({}));
  });
});

describe("canonicalizeView", () => {
  test("two spellings of one view compare equal", () => {
    // Left: written by an older client that stored its defaults explicitly and in another
    // field order. Right: what this build writes. They are the same board.
    const stored =
      '{"group":"column","priority":["HIGH","URGENT"],"view":"board","q":""}';
    const current = serializeView(
      state({ priorities: new Set(["URGENT", "HIGH"]) }),
      "board",
    );

    expect(canonicalizeView(stored)).toBe(canonicalizeView(current));
  });

  test("a filter that genuinely differs does not", () => {
    const urgent = serializeView(
      state({ priorities: new Set(["URGENT"]) }),
      "board",
    );
    const urgentOnTheTable = serializeView(
      state({ priorities: new Set(["URGENT"]) }),
      "table",
    );

    expect(canonicalizeView(urgent)).not.toBe(
      canonicalizeView(urgentOnTheTable),
    );
  });

  test("an unreadable view canonicalizes to the unfiltered board", () => {
    // Follows from the fallback in deserializeView, and is pinned because of what it implies:
    // a corrupted row renders as an empty board *and* shows as the active view while no
    // filters are set. Accepted — only this client ever writes the column — but not accidental.
    expect(canonicalizeView("{{{")).toBe(canonicalizeView("{}"));
  });
});
