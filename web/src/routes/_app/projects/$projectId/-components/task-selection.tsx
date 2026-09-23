import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export type TaskSelectionValue = {
  /** Selected *and* currently on screen. The only set anything should act on. */
  selected: ReadonlySet<number>;
  count: number;
  /**
   * Every task the toolbar is currently showing. Exposed so "select all" is one call from
   * anywhere — the table header needs it and has no other route to the rendered task set.
   */
  visibleTaskIds: number[];
  allVisibleSelected: boolean;
  isSelected: (taskId: number | string) => boolean;
  toggle: (taskId: number | string) => void;
  setMany: (taskIds: (number | string)[], selected: boolean) => void;
  clear: () => void;
};

/**
 * The selection minus anything the toolbar is currently hiding.
 *
 * Filtering at read time rather than pruning the stored set on every filter change is what keeps
 * two otherwise conflicting things true: a bulk action can never touch a task its owner cannot
 * see — which is the part that matters, since the action bar's count would otherwise be a lie —
 * while narrowing a filter and widening it again gives the selection back rather than quietly
 * destroying it.
 */
export function visibleSelection(
  selected: ReadonlySet<number>,
  visibleTaskIds: number[],
): ReadonlySet<number> {
  if (selected.size === 0) return selected;
  const visible = new Set(visibleTaskIds);
  return new Set([...selected].filter((id) => visible.has(id)));
}

const TaskSelectionContext = createContext<TaskSelectionValue | null>(null);

/**
 * Context rather than props because both views need this and neither owns it: the board reaches
 * a card through a column, the table through a row model, and the action bar sits beside both.
 */
export function TaskSelectionProvider({
  visibleTaskIds,
  children,
}: {
  visibleTaskIds: number[];
  children: ReactNode;
}) {
  const [stored, setStored] = useState<ReadonlySet<number>>(() => new Set());

  const selected = useMemo(
    () => visibleSelection(stored, visibleTaskIds),
    [stored, visibleTaskIds],
  );

  const toggle = useCallback((taskId: number | string) => {
    const id = Number(taskId);
    setStored((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const setMany = useCallback((taskIds: (number | string)[], on: boolean) => {
    setStored((current) => {
      const next = new Set(current);
      for (const taskId of taskIds) {
        on ? next.add(Number(taskId)) : next.delete(Number(taskId));
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => setStored(new Set()), []);

  const value = useMemo<TaskSelectionValue>(
    () => ({
      selected,
      count: selected.size,
      visibleTaskIds,
      allVisibleSelected:
        visibleTaskIds.length > 0 && selected.size === visibleTaskIds.length,
      isSelected: (taskId) => selected.has(Number(taskId)),
      toggle,
      setMany,
      clear,
    }),
    [selected, visibleTaskIds, toggle, setMany, clear],
  );

  return (
    <TaskSelectionContext.Provider value={value}>
      {children}
    </TaskSelectionContext.Provider>
  );
}

export function useTaskSelection(): TaskSelectionValue {
  const value = useContext(TaskSelectionContext);
  if (!value) {
    throw new Error(
      "useTaskSelection must be used inside TaskSelectionProvider",
    );
  }
  return value;
}
