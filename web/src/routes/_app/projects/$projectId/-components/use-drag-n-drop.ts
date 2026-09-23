import type { Plugins } from "@dnd-kit/abstract";
import { OptimisticSortingPlugin } from "@dnd-kit/dom/sortable";
import { move } from "@dnd-kit/helpers";
import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import type {
  ProjectColumnDetails,
  ProjectDetails,
  ProjectTaskDetails,
} from "@/api";
import {
  getProjectQueryKey,
  moveProjectColumnMutation,
} from "@/api/@tanstack/react-query.gen";
import {
  sortTasks,
  type ToolbarState,
  taskMatchesFilters,
} from "./toolbar-filters";
import { useMoveTask } from "./use-move-task";

export const colDndId = (id: ProjectColumnDetails["id"]) => `column:${id}`;
export const taskDndId = (id: ProjectTaskDetails["id"]) => `task:${id}`;

/**
 * The lane key for a board that is not split into swimlanes: one lane holding everything.
 *
 * Keeping it as a real key rather than a special case is what makes the ordinary board the
 * degenerate version of the swimlane board — one cell per column — so there is a single code
 * path through the order map, the optimistic order and the drop-score neighbours.
 */
export const ALL_LANES = "all";

/** The lane for tasks that belong to no section — or to one this board no longer has. */
export const NO_SECTION_LANE = "none";

/**
 * A **cell**: one column within one lane, and the unit the whole drag model is keyed by. With
 * swimlanes off there is exactly one cell per column, so this reduces to the old behaviour.
 */
export const cellDndId = (
  columnId: ProjectColumnDetails["id"],
  laneKey: string,
) => `cell:${columnId}:${laneKey}`;

const parseCellDndId = (dndId: string) => {
  const [, columnId, laneKey] = dndId.split(":");
  return { columnId: Number(columnId), laneKey };
};

/**
 * Which lane a task belongs in. A section the board no longer has falls into "no section"
 * rather than nowhere — someone can delete a section while another person holds the board open,
 * and a task that matches no lane would simply vanish off it.
 */
export const laneKeyOf = (
  task: ProjectTaskDetails,
  knownSectionIds: ReadonlySet<string>,
) =>
  task.sectionId != null && knownSectionIds.has(String(task.sectionId))
    ? String(task.sectionId)
    : NO_SECTION_LANE;
// A column is both a task drop target (`colDndId`) and a reorderable item
// (`colSortDndId`); the two need distinct ids so dnd-kit's registry keeps them
// apart.
export const colSortDndId = (id: ProjectColumnDetails["id"]) => `colsort:${id}`;
const parseTaskDndId = (dndId: string) => Number(dndId.split(":")[1]);
const parseColSortDndId = (dndId: string) => Number(dndId.split(":")[1]);

/**
 * React drives the optimistic reordering during a drag (see `handleDragOver`),
 * so dnd-kit's OptimisticSortingPlugin — which physically relocates the dragged
 * element in the DOM via `insertAdjacentElement` — is both redundant and, on
 * table rows, the source of "removeChild: node is not a child of this node"
 * crashes when its DOM move races React's reconciliation. Drop it and let React
 * own the DOM; the sortable transition still animates index changes.
 */
export const sortablePlugins = (defaults: Plugins): Plugins =>
  defaults.filter((plugin) => plugin !== OptimisticSortingPlugin);

export function scoreBetween(above?: number, below?: number): number {
  const a = above ?? NaN;
  const b = below ?? NaN;
  if (Number.isNaN(a) && Number.isNaN(b)) return 1000;
  if (Number.isNaN(a)) return b + 1000;
  if (Number.isNaN(b)) return a - 1000;
  return (a + b) / 2;
}

/**
 * Where a task lands when it is moved without being dragged — from the card's "Move to"
 * menu, which has no neighbours to interpolate between because the target column is not
 * the one being looked at.
 *
 * Top of the column (tasks render highest score first), which is the same placement the
 * server picks for the other neighbourless move it owns: `PATCH /api/tasks/{id}/project`
 * scores a cross-project file at `maxScore + 1000f`.
 */
export function scoreAtTopOf(column: ProjectColumnDetails): number {
  const top = column.tasks.length
    ? Math.max(...column.tasks.map((t) => Number(t.score)))
    : undefined;
  return scoreBetween(undefined, top);
}

// Columns render in ascending score order (leftmost/topmost = lowest), so the
// neighbour semantics are flipped relative to tasks: `before` is the lower-score
// column, `after` the higher one.
export function columnScoreBetween(before?: number, after?: number): number {
  const a = before ?? NaN;
  const b = after ?? NaN;
  if (Number.isNaN(a) && Number.isNaN(b)) return 1000;
  if (Number.isNaN(a)) return b - 1000;
  if (Number.isNaN(b)) return a + 1000;
  return (a + b) / 2;
}

/** Keyed by {@link cellDndId}: every (column, lane) pair the board is currently showing. */
type TasksOrder = Record<string, string[]>;

/** One swimlane: a section (or the catch-all) and the columns as seen from inside it. */
export type BoardLane = {
  key: string;
  label: string;
  color: string | null;
  columns: ProjectColumnDetails[];
};
type ColumnsOrder = string[];

export type DndReturnValue = {
  handleDragStart: (event: DragStartEvent) => void;
  handleDragOver: (event: DragOverEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  effectiveColumns: ProjectColumnDetails[];
  /**
   * The Section x Column grid, empty unless the toolbar is grouping by section. Derived from the
   * same order map as `effectiveColumns`, so the two can never disagree about where a task is.
   */
  lanes: BoardLane[];
  swimlanes: boolean;
  /**
   * Task drag is meaningless while a manual sort is active: the rendered order
   * no longer follows `score`, so the neighbours a drop lands between would
   * produce a score that doesn't match where the task visually went.
   */
  dragDisabled: boolean;
};

export function useDragNDrop(
  project: ProjectDetails,
  toolbarState: ToolbarState,
): DndReturnValue {
  const queryClient = useQueryClient();
  const orderRef = useRef<TasksOrder>(null);
  const columnsRef = useRef<ColumnsOrder>(null);
  const [optimisticOrder, setOptimisticOrder] = useState<TasksOrder | null>(
    null,
  );
  const [optimisticColumns, setOptimisticColumns] =
    useState<ColumnsOrder | null>(null);
  const { columns } = project;

  const moveColumnMut = useMutation(moveProjectColumnMutation());
  const { moveTask } = useMoveTask(project);

  const tasksByIds = useMemo(
    () =>
      columns
        .flatMap((c) => c.tasks)
        .reduce(
          (acc, task) => acc.set(Number(task.id), task),
          new Map<number, ProjectTaskDetails>(),
        ),
    [columns],
  );

  // Base order is derived purely from `score` (highest first) so it always
  // matches how both views render tasks. During a drag the optimistic order
  // (from `move`) takes over; scores are only rewritten on drop.
  //
  // The toolbar's filters and sort are applied here rather than in the views so
  // that the rendered task set, dnd-kit's sortable indices, the optimistic order
  // and the neighbours used to compute a drop score are all derived from the
  // same list — reconciling them separately per view would desync them.
  // Grouping by section is what turns the board into swimlanes — the same toolbar control that
  // groups the table, rather than a second concept meaning the same thing.
  const swimlanes = toolbarState.groupBy === "section";

  const sections = useMemo(
    () =>
      [...project.sections].sort((a, b) => Number(a.score) - Number(b.score)),
    [project.sections],
  );

  const knownSectionIds = useMemo(
    () => new Set(sections.map((s) => String(s.id))),
    [sections],
  );

  // The lanes the board is split into, in render order. Off, it is the single catch-all lane,
  // which is what keeps one code path below.
  const laneKeys = useMemo(
    () =>
      swimlanes
        ? [...sections.map((s) => String(s.id)), NO_SECTION_LANE]
        : [ALL_LANES],
    [swimlanes, sections],
  );

  const tasksMap = useMemo(
    () =>
      columns.reduce((acc, col) => {
        const visible = col.tasks.filter((t) =>
          taskMatchesFilters(t, toolbarState),
        );
        const ordered = toolbarState.sort
          ? sortTasks(visible, toolbarState.sort)
          : visible.sort((a, b) => Number(b.score) - Number(a.score));

        for (const laneKey of laneKeys) {
          acc[cellDndId(col.id, laneKey)] = ordered
            .filter(
              (t) =>
                laneKey === ALL_LANES ||
                laneKeyOf(t, knownSectionIds) === laneKey,
            )
            .map((t) => taskDndId(t.id));
        }

        return acc;
      }, {} as TasksOrder),
    [columns, toolbarState, laneKeys, knownSectionIds],
  );

  // Base column order is derived purely from `score` (lowest first). During a
  // column drag the optimistic order takes over; scores are rewritten on drop.
  const baseColumnOrder = useMemo(
    () =>
      [...columns]
        .sort((a, b) => Number(a.score) - Number(b.score))
        .map((c) => colSortDndId(c.id)),
    [columns],
  );

  // Column order and task order are independent: a drag reorders one or the
  // other, never both, so each optimistic layer falls back to its score-sorted
  // base when idle.
  // One place resolves a cell's ids into tasks, so `effectiveColumns` and `lanes` cannot drift.
  const readCell = useCallback(
    (
      taskOrder: TasksOrder,
      columnId: ProjectColumnDetails["id"],
      laneKey: string,
    ) =>
      (taskOrder[cellDndId(columnId, laneKey)] ?? []).map(
        (taskId) => tasksByIds.get(parseTaskDndId(taskId))!,
      ),
    [tasksByIds],
  );

  const orderedColumns = useCallback(
    (columnOrder: ColumnsOrder) =>
      columnOrder.map(
        (sortId) => columns.find((c) => colSortDndId(c.id) === sortId)!,
      ),
    [columns],
  );

  /**
   * Every visible task, still grouped by column. In swimlane mode this concatenates the lanes,
   * because the table and the column drag both need the whole column — only the board's
   * swimlane layout cares which lane a task sits in.
   */
  const effectiveColumns = useMemo(() => {
    const taskOrder = optimisticOrder ?? tasksMap;
    const columnOrder = optimisticColumns ?? baseColumnOrder;
    return orderedColumns(columnOrder).map(
      (col): ProjectColumnDetails => ({
        ...col,
        tasks: laneKeys.flatMap((laneKey) =>
          readCell(taskOrder, col.id, laneKey),
        ),
      }),
    );
  }, [
    optimisticOrder,
    optimisticColumns,
    tasksMap,
    baseColumnOrder,
    laneKeys,
    orderedColumns,
    readCell,
  ]);

  const lanes = useMemo((): BoardLane[] => {
    if (!swimlanes) return [];

    const taskOrder = optimisticOrder ?? tasksMap;
    const columnOrder = optimisticColumns ?? baseColumnOrder;
    const byId = new Map(sections.map((s) => [String(s.id), s]));

    return laneKeys.map((laneKey) => {
      const section = byId.get(laneKey);
      return {
        key: laneKey,
        label: section?.name ?? "No section",
        color: section?.color ?? null,
        columns: orderedColumns(columnOrder).map((col) => ({
          ...col,
          tasks: readCell(taskOrder, col.id, laneKey),
        })),
      };
    });
  }, [
    swimlanes,
    optimisticOrder,
    optimisticColumns,
    tasksMap,
    baseColumnOrder,
    laneKeys,
    sections,
    orderedColumns,
    readCell,
  ]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { source } = event.operation;
      if (!source) return;

      const cloneOrder = () => {
        return Object.entries(tasksMap).reduce((acc, kv) => {
          acc[kv[0]] = [...kv[1]];
          return acc;
        }, {} as TasksOrder);
      };

      if (source.type === "task") {
        setOptimisticOrder(cloneOrder());
        orderRef.current = cloneOrder();
      }

      if (source.type === "column") {
        setOptimisticColumns([...baseColumnOrder]);
        columnsRef.current = [...baseColumnOrder];
      }
    },
    [tasksMap, baseColumnOrder],
  );

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { source, target } = event.operation;
    if (!source || !target) return;

    if (source.type === "task") {
      const prev = orderRef.current;
      if (!prev) return;
      const next = move(prev, event);
      orderRef.current = next;
      setOptimisticOrder(next);
      return;
    }

    if (source.type === "column") {
      const prev = columnsRef.current;
      if (!prev) return;
      const next = move(prev, event);
      columnsRef.current = next;
      setOptimisticColumns(next);
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { source, target } = event.operation;

      const cleanup = () => {
        setOptimisticOrder(null);
        orderRef.current = null;
        setOptimisticColumns(null);
        columnsRef.current = null;
      };

      const queryKeyBase = getProjectQueryKey({
        path: { projectId: Number(project.id) },
      });

      if (!source || !target) return cleanup();

      if (source.type === "column") {
        const newColOrder = columnsRef.current;
        if (!newColOrder) return cleanup();

        const movedSortId = String(source.id);
        const movedColId = parseColSortDndId(movedSortId);
        const idx = newColOrder.indexOf(movedSortId);
        if (idx === -1) return cleanup();

        const getColScore = (sortId: string | undefined) => {
          if (!sortId) return undefined;
          return Number(
            columns.find((c) => colSortDndId(c.id) === sortId)?.score,
          );
        };

        const newScore = columnScoreBetween(
          getColScore(newColOrder[idx - 1]),
          getColScore(newColOrder[idx + 1]),
        );

        queryClient.setQueryData(
          queryKeyBase,
          (p: ProjectDetails | undefined) =>
            p && {
              ...p,
              columns: p.columns.map((c) =>
                Number(c.id) === movedColId ? { ...c, score: newScore } : c,
              ),
            },
        );

        moveColumnMut.mutate(
          {
            path: { projectId: Number(project.id), columnId: movedColId },
            body: { score: newScore },
          },
          {
            onSuccess: (updatedColumn) => {
              queryClient.setQueryData(
                queryKeyBase,
                (p: ProjectDetails | undefined) =>
                  p && {
                    ...p,
                    columns: p.columns.map((c) =>
                      Number(c.id) === movedColId
                        ? { ...c, score: updatedColumn.score }
                        : c,
                    ),
                  },
              );
            },
            onError: () => {
              queryClient.invalidateQueries({ queryKey: queryKeyBase });
            },
            onSettled: cleanup,
          },
        );
        return;
      }

      if (source.type !== "task") return cleanup();

      const newOrder = orderRef.current;
      if (!newOrder) return cleanup();

      const sourceId = parseTaskDndId(String(source.id));
      const sourceDndId = String(source.id);

      // The destination is whichever *cell* now holds the source after `move`, regardless of
      // whether it was dropped onto a task or an empty one. In swimlane mode that cell names
      // both the column and the lane, which is how a drop across lanes becomes a section change.
      const destEntry = Object.entries(newOrder).find(([, ids]) =>
        ids.includes(sourceDndId),
      );
      if (!destEntry) return cleanup();

      const [destCellDndId, destIds] = destEntry;
      const { columnId: destColumnId, laneKey } = parseCellDndId(destCellDndId);
      const destinationCol = columns.find((c) => Number(c.id) === destColumnId);
      if (!destinationCol) return cleanup();

      // Score is computed from the source's real neighbours at its landing
      // position (their scores are unchanged — only the source's moves).
      const srcIdx = destIds.indexOf(sourceDndId);

      const getTaskScore = (taskId: string | undefined) => {
        if (!taskId) return undefined;
        return Number(tasksByIds.get(parseTaskDndId(taskId))?.score);
      };

      const newScore = scoreBetween(
        getTaskScore(destIds[srcIdx - 1]),
        getTaskScore(destIds[srcIdx + 1]),
      );

      const movedTask = tasksByIds.get(sourceId)!;

      // Always the intended final section, never "leave it alone" — the request has no way to
      // express the difference, so the catch-all lane resends what the task already had.
      const destinationSectionId =
        laneKey === ALL_LANES
          ? movedTask.sectionId == null
            ? null
            : Number(movedTask.sectionId)
          : laneKey === NO_SECTION_LANE
            ? null
            : Number(laneKey);

      moveTask(
        movedTask,
        Number(destinationCol.id),
        newScore,
        destinationSectionId,
        { onSettled: cleanup },
      );
    },
    [columns, moveColumnMut, moveTask, project, queryClient, tasksByIds],
  );

  return {
    effectiveColumns,
    lanes,
    swimlanes,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    dragDisabled: toolbarState.sort !== null,
  };
}
