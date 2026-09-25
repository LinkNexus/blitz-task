import { useMemo } from "react";
import type { ProjectDetails } from "@/api";
import { cn } from "@/lib/utils";
import { buildDependencyGraph, type GraphNode } from "./dependency-graph";

type Props = {
  project: ProjectDetails;
  /** Whether the toolbar is currently filtering, so the view can say that it is not. */
  filtersActive: boolean;
};

// The node box and the gaps around it. Numbers rather than Tailwind classes because the edges
// are drawn in SVG, which needs the actual coordinates.
const NODE_WIDTH = 190;
const NODE_HEIGHT = 62;
const LAYER_GAP = 90;
const ROW_GAP = 22;
const PADDING = 24;

const xOf = (node: GraphNode) =>
  PADDING + node.layer * (NODE_WIDTH + LAYER_GAP);
const yOf = (node: GraphNode) => PADDING + node.row * (NODE_HEIGHT + ROW_GAP);

/**
 * The project's dependencies, drawn (L40.6 follow-up).
 *
 * <b>Edges in SVG, nodes in HTML, overlaid.</b> Curves need a path and real coordinates, which
 * is SVG's job; a node needs to be a focusable control with text that wraps and truncates, which
 * is HTML's. Drawing the nodes in SVG too costs both — `<text>` neither wraps nor ellipsizes, so
 * names had to be cut by hand, and a `<g role="button">` is a button only by assertion. The
 * layout is shared: one module hands back a layer and a row per node and both halves read it.
 *
 * No graph library, because there is nothing left for one to do: the layout is already computed,
 * and a library would bring its own layout engine, its own event model and a second opinion
 * about what a node is.
 *
 * <b>Filters are deliberately not applied here.</b> Hiding a task mid-chain leaves arrows
 * pointing at nothing and a reader inferring a dependency that does not exist; a graph with gaps
 * is worse than one that ignores the filter, so the view says so instead.
 */
export function GraphView({ project, filtersActive }: Props) {
  const graph = useMemo(() => buildDependencyGraph(project), [project]);

  const positions = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes],
  );

  // The same event the board card and the table row dispatch, so all three open one sheet.
  const openTask = (taskId: number) => {
    const task = project.columns
      .flatMap((column) => column.tasks)
      .find((t) => Number(t.id) === taskId);

    if (task) {
      document.dispatchEvent(new CustomEvent("task.update", { detail: task }));
    }
  };

  if (graph.nodes.length === 0) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-center">
        <p className="text-sm font-medium">
          Nothing is waiting on anything yet
        </p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Open a task and add a blocker under Dependencies. Tasks appear here
          once they block something or are blocked by something.
        </p>
      </div>
    );
  }

  const layers = Math.max(...graph.nodes.map((n) => n.layer)) + 1;
  const width = PADDING * 2 + layers * NODE_WIDTH + (layers - 1) * LAYER_GAP;
  const height = PADDING * 2 + graph.widestLayer * (NODE_HEIGHT + ROW_GAP);

  return (
    <div className="space-y-3">
      {filtersActive && (
        <p className="text-xs text-muted-foreground">
          Filters don't apply here — a chain with gaps in it would imply
          dependencies that do not exist.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border bg-card p-2">
        <div className="relative" style={{ width, height }}>
          <svg
            width={width}
            height={height}
            className="absolute inset-0"
            aria-hidden="true"
          >
            <defs>
              <marker
                id="dependency-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path
                  d="M 0 0 L 10 5 L 0 10 z"
                  className="fill-muted-foreground/50"
                />
              </marker>
            </defs>

            {graph.edges.map((edge) => {
              const from = positions.get(edge.from);
              const to = positions.get(edge.to);
              if (!from || !to) return null;

              const x1 = xOf(from) + NODE_WIDTH;
              const y1 = yOf(from) + NODE_HEIGHT / 2;
              const x2 = xOf(to);
              const y2 = yOf(to) + NODE_HEIGHT / 2;
              // Horizontal handles on a cubic: layers are columns, so leaving and arriving
              // horizontally keeps an arrow readable even when it spans several rows.
              const bend = Math.max(30, (x2 - x1) / 2);

              return (
                <path
                  key={`${edge.from}-${edge.to}`}
                  d={`M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  className="stroke-muted-foreground/40"
                  strokeWidth={1.5}
                  markerEnd="url(#dependency-arrow)"
                />
              );
            })}
          </svg>

          {graph.nodes.map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => openTask(node.id)}
              style={{
                left: xOf(node),
                top: yOf(node),
                width: NODE_WIDTH,
                height: NODE_HEIGHT,
              }}
              className={cn(
                "absolute flex flex-col justify-center gap-0.5 rounded-lg border bg-background px-3 text-left transition-colors",
                "hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                node.openBlockerCount > 0 && "border-amber-500/60",
                node.isCompleted && "bg-muted",
              )}
            >
              <span
                className={cn(
                  "truncate text-xs font-medium",
                  node.isCompleted && "text-muted-foreground line-through",
                )}
              >
                {node.name}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {node.isCompleted
                  ? "Done"
                  : node.openBlockerCount > 0
                    ? `Waiting on ${node.openBlockerCount}`
                    : "Ready"}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
