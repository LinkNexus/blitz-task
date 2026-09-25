import { useMemo } from "react";
import type { ProjectDetails } from "@/api";
import { cn } from "@/lib/utils";
import { buildTimeline, type TimelineBar } from "./timeline";

type Props = {
  project: ProjectDetails;
  /** Whether the toolbar is filtering, so the view can say that it is not. */
  filtersActive: boolean;
};

const DAY_WIDTH = 34;
const ROW_HEIGHT = 34;
const LABEL_WIDTH = 190;
const HEADER_HEIGHT = 40;

const xOf = (bar: TimelineBar) => bar.offsetDays * DAY_WIDTH;
const widthOf = (bar: TimelineBar) =>
  Math.max(DAY_WIDTH, bar.lengthDays * DAY_WIDTH);
const yOf = (bar: TimelineBar) => bar.row * ROW_HEIGHT;

/**
 * The project along dates: a bar per task from start to due, with L40.6's dependencies drawn
 * between them.
 *
 * <b>HTML bars over an SVG</b>, the same split the dependency graph settled on: curves and
 * gridlines need real coordinates, and a bar needs to be a focusable control whose label wraps
 * and truncates — which SVG `<text>` will not do.
 *
 * <b>Filters do not apply</b>, for the same reason they do not on the graph: a chart with holes
 * in it implies a schedule that does not exist.
 */
export function TimelineView({ project, filtersActive }: Props) {
  const timeline = useMemo(() => buildTimeline(project), [project]);

  const byId = useMemo(
    () => new Map(timeline.bars.map((bar) => [bar.id, bar])),
    [timeline.bars],
  );

  const openTask = (taskId: number) => {
    const task = project.columns
      .flatMap((column) => column.tasks)
      .find((t) => Number(t.id) === taskId);

    if (task) {
      document.dispatchEvent(new CustomEvent("task.update", { detail: task }));
    }
  };

  if (timeline.bars.length === 0) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-center">
        <p className="text-sm font-medium">Nothing is scheduled yet</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Give a task a start or a due date and it appears here. Tasks with
          neither are not on the timeline.
        </p>
      </div>
    );
  }

  const chartWidth = timeline.totalDays * DAY_WIDTH;
  const chartHeight = timeline.bars.length * ROW_HEIGHT;

  const days = Array.from({ length: timeline.totalDays }, (_, i) => {
    const date = new Date(timeline.start);
    date.setDate(date.getDate() + i);
    return date;
  });

  return (
    <div className="space-y-3">
      {filtersActive && (
        <p className="text-xs text-muted-foreground">
          Filters don't apply here — a chart with gaps in it would imply a
          schedule that does not exist.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border bg-card">
        <div style={{ width: LABEL_WIDTH + chartWidth }}>
          {/* Date header */}
          <div className="flex border-b" style={{ height: HEADER_HEIGHT }}>
            <div
              className="shrink-0 border-r bg-muted/30"
              style={{ width: LABEL_WIDTH }}
            />
            {days.map((day, i) => {
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const isFirst = day.getDate() === 1 || i === 0;
              return (
                <div
                  key={day.toISOString()}
                  style={{ width: DAY_WIDTH }}
                  className={cn(
                    "shrink-0 border-r text-center text-[10px] leading-tight",
                    isWeekend && "bg-muted/40",
                    i === timeline.todayOffset && "bg-primary/10",
                  )}
                >
                  {/* The month is printed only where it changes; on every column it would be
                      noise at this width. */}
                  <div className="pt-1 text-muted-foreground">
                    {isFirst
                      ? day.toLocaleDateString(undefined, { month: "short" })
                      : ""}
                  </div>
                  <div className="font-medium tabular-nums">
                    {day.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex">
            {/* Task names, in their own column so a long name never overlaps the chart. */}
            <div
              className="shrink-0 border-r bg-muted/30"
              style={{ width: LABEL_WIDTH }}
            >
              {timeline.bars.map((bar) => (
                <div
                  key={bar.id}
                  style={{ height: ROW_HEIGHT }}
                  className={cn(
                    "flex items-center truncate px-3 text-xs",
                    bar.isCompleted && "text-muted-foreground line-through",
                  )}
                >
                  {bar.name}
                </div>
              ))}
            </div>

            <div
              className="relative"
              style={{ width: chartWidth, height: chartHeight }}
            >
              <svg
                width={chartWidth}
                height={chartHeight}
                className="absolute inset-0"
                aria-hidden="true"
              >
                <defs>
                  <marker
                    id="timeline-arrow"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="5"
                    markerHeight="5"
                    orient="auto-start-reverse"
                  >
                    <path
                      d="M 0 0 L 10 5 L 0 10 z"
                      className="fill-muted-foreground/50"
                    />
                  </marker>
                </defs>

                {/* Day columns, so a bar can be read back to a date without counting. */}
                {days.map((day, i) => (
                  <rect
                    key={day.toISOString()}
                    x={i * DAY_WIDTH}
                    y={0}
                    width={DAY_WIDTH}
                    height={chartHeight}
                    className={cn(
                      "fill-transparent",
                      (day.getDay() === 0 || day.getDay() === 6) &&
                        "fill-muted/40",
                    )}
                  />
                ))}

                {timeline.todayOffset !== null && (
                  <line
                    x1={timeline.todayOffset * DAY_WIDTH + DAY_WIDTH / 2}
                    y1={0}
                    x2={timeline.todayOffset * DAY_WIDTH + DAY_WIDTH / 2}
                    y2={chartHeight}
                    className="stroke-primary/60"
                    strokeWidth={2}
                  />
                )}

                {timeline.arrows.map((arrow) => {
                  const from = byId.get(arrow.from);
                  const to = byId.get(arrow.to);
                  if (!from || !to) return null;

                  const x1 = xOf(from) + widthOf(from);
                  const y1 = yOf(from) + ROW_HEIGHT / 2;
                  const x2 = xOf(to);
                  const y2 = yOf(to) + ROW_HEIGHT / 2;
                  const bend = Math.max(14, (x2 - x1) / 2);

                  return (
                    <path
                      key={`${arrow.from}-${arrow.to}`}
                      d={`M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`}
                      fill="none"
                      className="stroke-muted-foreground/40"
                      strokeWidth={1.5}
                      markerEnd="url(#timeline-arrow)"
                    />
                  );
                })}
              </svg>

              {timeline.bars.map((bar) => (
                <button
                  key={bar.id}
                  type="button"
                  onClick={() => openTask(bar.id)}
                  title={bar.name}
                  style={{
                    left: xOf(bar) + 2,
                    top: yOf(bar) + 6,
                    width: widthOf(bar) - 4,
                    height: ROW_HEIGHT - 12,
                  }}
                  className={cn(
                    "absolute truncate rounded-md border px-2 text-left text-[11px] leading-none transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    bar.isCompleted
                      ? "border-border bg-muted text-muted-foreground"
                      : "border-primary/40 bg-primary/15 hover:bg-primary/25",
                  )}
                >
                  {/* A single-day bar has no room for a label; the column beside it carries the
                      name, and the title attribute covers a hover. */}
                  {bar.isMilestone ? "" : bar.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
