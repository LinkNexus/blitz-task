import { describe, expect, test } from "bun:test";
import type { ProjectDetails } from "@/api";
import { buildDependencyGraph } from "./dependency-graph";

type Spec = {
  id: number;
  name?: string;
  columnId?: number;
  blockedBy?: number[];
};

/**
 * A project whose tasks all sit in column 1, with column 2 as the "done" position — so a task
 * placed in 2 reads as completed, the same rule the board uses.
 */
const project = (specs: Spec[]): ProjectDetails => {
  const byId = new Map(specs.map((s) => [s.id, s]));
  const link = (id: number) => ({
    id,
    name: byId.get(id)?.name ?? `Task ${id}`,
    columnId: byId.get(id)?.columnId ?? 1,
  });

  return {
    columns: [
      {
        id: 1,
        name: "Todo",
        score: 0,
        tasks: specs.map((s) => ({
          id: s.id,
          name: s.name ?? `Task ${s.id}`,
          columnId: s.columnId ?? 1,
          blockedBy: (s.blockedBy ?? []).map(link),
          blocks: specs
            .filter((other) => (other.blockedBy ?? []).includes(s.id))
            .map((other) => link(other.id)),
        })),
      },
      { id: 2, name: "Done", score: 1000, tasks: [] },
    ],
  } as unknown as ProjectDetails;
};

describe("buildDependencyGraph", () => {
  test("a chain lays out one layer per link", () => {
    const graph = buildDependencyGraph(
      project([
        { id: 1, name: "A" },
        { id: 2, name: "B", blockedBy: [1] },
        { id: 3, name: "C", blockedBy: [2] },
      ]),
    );

    expect(graph.nodes.map((n) => [n.name, n.layer])).toEqual([
      ["A", 0],
      ["B", 1],
      ["C", 2],
    ]);
    expect(graph.edges).toEqual([
      { from: 1, to: 2 },
      { from: 2, to: 3 },
    ]);
  });

  test("a task sits after its latest blocker, not its earliest", () => {
    // D waits on A (layer 0) and on C (layer 2). Shortest-path layering would put it at 1 and
    // draw the arrow from C backwards; longest-path keeps every arrow pointing forward.
    const graph = buildDependencyGraph(
      project([
        { id: 1, name: "A" },
        { id: 2, name: "B", blockedBy: [1] },
        { id: 3, name: "C", blockedBy: [2] },
        { id: 4, name: "D", blockedBy: [1, 3] },
      ]),
    );

    expect(graph.nodes.find((n) => n.name === "D")?.layer).toBe(3);
  });

  test("a diamond keeps both arms on the same layer", () => {
    const graph = buildDependencyGraph(
      project([
        { id: 1, name: "Top" },
        { id: 2, name: "Left", blockedBy: [1] },
        { id: 3, name: "Right", blockedBy: [1] },
        { id: 4, name: "Bottom", blockedBy: [2, 3] },
      ]),
    );

    const layers = Object.fromEntries(
      graph.nodes.map((n) => [n.name, n.layer]),
    );
    expect(layers).toEqual({ Top: 0, Left: 1, Right: 1, Bottom: 2 });

    // Two nodes share layer 1, so they need distinct rows or they would draw on top of one
    // another.
    const middle = graph.nodes.filter((n) => n.layer === 1).map((n) => n.row);
    expect(middle.sort()).toEqual([0, 1]);
    expect(graph.widestLayer).toBe(2);
  });

  test("tasks with no dependencies at all are left out", () => {
    const graph = buildDependencyGraph(
      project([
        { id: 1, name: "A" },
        { id: 2, name: "B", blockedBy: [1] },
        { id: 3, name: "Unrelated" },
        { id: 4, name: "Also unrelated" },
      ]),
    );

    // The graph answers "what is waiting on what". Forty-seven isolated boxes would bury the
    // three that are part of that question.
    expect(graph.nodes.map((n) => n.name)).toEqual(["A", "B"]);
  });

  test("a project with no dependencies produces an empty graph", () => {
    const graph = buildDependencyGraph(project([{ id: 1 }, { id: 2 }]));
    expect(graph).toEqual({ nodes: [], edges: [], widestLayer: 0 });
  });

  test("a node reports completion and how many blockers are still open", () => {
    const graph = buildDependencyGraph(
      project([
        { id: 1, name: "Done blocker", columnId: 2 },
        { id: 2, name: "Open blocker" },
        { id: 3, name: "Waiting", blockedBy: [1, 2] },
      ]),
    );

    // One of its two blockers is finished, so only one still holds it up.
    expect(
      graph.nodes.find((n) => n.name === "Waiting")?.openBlockerCount,
    ).toBe(1);
    expect(
      graph.nodes.find((n) => n.name === "Done blocker")?.isCompleted,
    ).toBe(true);
  });

  test("an edge to a task outside the graph is dropped rather than dangling", () => {
    // Defensive: a blocker the projection did not carry — a trashed one, say — must not become
    // an arrow pointing at a node that was never drawn.
    const graph = buildDependencyGraph({
      columns: [
        {
          id: 1,
          name: "Todo",
          score: 0,
          tasks: [
            {
              id: 1,
              name: "Orphan",
              columnId: 1,
              blockedBy: [{ id: 99, name: "Gone", columnId: 1 }],
              blocks: [],
            },
          ],
        },
      ],
    } as unknown as ProjectDetails);

    expect(graph.edges).toEqual([]);
    expect(graph.nodes.map((n) => n.name)).toEqual(["Orphan"]);
  });
});
