import type { ProjectDetails, ProjectTaskDetails } from "@/api";
import { isCompletedColumn } from "./task-dependencies";

export type GraphNode = {
  id: number;
  name: string;
  isCompleted: boolean;
  /** Blockers of this node that are not finished — what makes it *currently* blocked. */
  openBlockerCount: number;
  /** How far down the chain it sits: 0 has nothing waiting on, 1 waits on a 0, and so on. */
  layer: number;
  /** Position within its layer, so a renderer needs no layout pass of its own. */
  row: number;
};

/** An arrow from blocker to dependent — the direction work actually flows. */
export type GraphEdge = { from: number; to: number };

export type DependencyGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Widest layer, so a caller can size the canvas without walking the nodes. */
  widestLayer: number;
};

/**
 * Turns a project into the graph its dependencies describe.
 *
 * <b>Only tasks with an edge appear.</b> A project of fifty tasks and three dependencies would
 * otherwise render forty-seven isolated boxes, which says nothing and buries the three that do.
 * The graph answers "what is waiting on what", and a task in neither position is not part of
 * that question.
 *
 * <b>Layering is longest-path, not shortest.</b> A task sits one layer after the *latest* of its
 * blockers, so an arrow always points forward and a chain reads left to right without an edge
 * ever doubling back. That terminates only because the graph is acyclic, which the server
 * guarantees by refusing to store a loop — there is no cycle guard here because there cannot be
 * a cycle to guard against.
 */
export function buildDependencyGraph(project: ProjectDetails): DependencyGraph {
  const tasks = project.columns.flatMap((column) => column.tasks);

  const connected = tasks.filter(
    (task) => task.blockedBy.length > 0 || task.blocks.length > 0,
  );

  if (connected.length === 0) {
    return { nodes: [], edges: [], widestLayer: 0 };
  }

  const byId = new Map<number, ProjectTaskDetails>(
    connected.map((task) => [Number(task.id), task]),
  );

  const edges: GraphEdge[] = [];
  for (const task of connected) {
    for (const blocker of task.blockedBy) {
      // Read from one side only. Every edge is stored on the task being blocked, so walking
      // `blocks` as well would add each arrow twice.
      if (byId.has(Number(blocker.id))) {
        edges.push({ from: Number(blocker.id), to: Number(task.id) });
      }
    }
  }

  const layerOf = new Map<number, number>();

  const resolve = (id: number): number => {
    const cached = layerOf.get(id);
    if (cached !== undefined) return cached;

    const task = byId.get(id);
    const blockers = (task?.blockedBy ?? []).filter((b) =>
      byId.has(Number(b.id)),
    );

    // Written before recursing, so a graph that somehow did contain a loop would terminate with
    // a wrong layer rather than overflowing the stack. The server makes that unreachable; this
    // is only here so a bug over there cannot take the page down.
    layerOf.set(id, 0);

    const layer =
      blockers.length === 0
        ? 0
        : 1 + Math.max(...blockers.map((b) => resolve(Number(b.id))));

    layerOf.set(id, layer);
    return layer;
  };

  for (const task of connected) resolve(Number(task.id));

  const rows = new Map<number, number>();
  const nodes: GraphNode[] = connected
    // Sorted before rows are handed out so the layout is stable across renders rather than
    // following whatever order the columns happened to yield.
    .sort((a, b) => {
      const layerDiff = resolve(Number(a.id)) - resolve(Number(b.id));
      return layerDiff !== 0 ? layerDiff : a.name.localeCompare(b.name);
    })
    .map((task) => {
      const id = Number(task.id);
      const layer = resolve(id);
      const row = rows.get(layer) ?? 0;
      rows.set(layer, row + 1);

      return {
        id,
        name: task.name,
        isCompleted: isCompletedColumn(task.columnId, project),
        openBlockerCount: task.blockedBy.filter(
          (blocker) => !isCompletedColumn(blocker.columnId, project),
        ).length,
        layer,
        row,
      };
    });

  return {
    nodes,
    edges,
    widestLayer: Math.max(0, ...[...rows.values()]),
  };
}
