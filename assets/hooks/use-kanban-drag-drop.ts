import { useState } from 'react';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { toast } from 'sonner';
import type { Task, TaskColumn } from '@/types';

interface UseKanbanDragDropProps {
  initialTasks: Task[];
  initialColumns: TaskColumn[];
}

interface UseKanbanDragDropReturn {
  tasks: Task[];
  columns: TaskColumn[];
  activeTask: Task | null;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  getTasksForColumn: (column: TaskColumn) => Task[];
  moveTaskToColumn: (taskId: number, targetColumn: TaskColumn) => void;
  addTask: (task: Omit<Task, 'id' | 'score'>) => void;
  deleteTask: (taskId: number) => void;
  updateTask: (taskId: number, updates: Partial<Task>) => void;
  addColumn: (column: Omit<TaskColumn, 'id'>) => void;
  deleteColumn: (columnId: number) => void;
  updateColumn: (columnId: number, updates: Partial<TaskColumn>) => void;
  addColumnBetween: (afterColumnId: number, column: Omit<TaskColumn, 'id' | 'score'>) => void;
}

export function useKanbanDragDrop({ initialTasks, initialColumns }: UseKanbanDragDropProps): UseKanbanDragDropReturn {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [columns, setColumns] = useState<TaskColumn[]>(initialColumns);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Get tasks for a specific column, sorted by score
  const getTasksForColumn = (column: TaskColumn): Task[] => {
    return tasks
      .filter(task => task.relatedColumn.id === column.id)
      .sort((a, b) => a.score - b.score);
  };

  // Generate new task ID
  const generateTaskId = (): number => {
    return Math.max(...tasks.map(t => t.id), 0) + 1;
  };

  // Generate new column ID
  const generateColumnId = (): number => {
    return Math.max(...columns.map(c => c.id), 0) + 1;
  };

  // Move task to a different column
  const moveTaskToColumn = (taskId: number, targetColumn: TaskColumn): void => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    if (task.relatedColumn.id === targetColumn.id) return;

    const targetColumnTasks = getTasksForColumn(targetColumn);
    const newScore = targetColumnTasks.length > 0 ? Math.max(...targetColumnTasks.map(t => t.score)) + 1 : 0;

    setTasks(prevTasks =>
      prevTasks.map(t =>
        t.id === taskId
          ? { ...t, relatedColumn: targetColumn, score: newScore }
          : t
      )
    );

    toast.success(`Moved "${task.name}" to ${targetColumn.name}`);
  };

  // Move task to specific position in a column
  const moveTaskToPosition = (taskId: number, targetColumn: TaskColumn, targetScore: number): void => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    setTasks(prevTasks => {
      // First, update scores in the target column to make space
      const updatedTasks = prevTasks.map(t => {
        if (t.relatedColumn.id === targetColumn.id && t.score >= targetScore) {
          return { ...t, score: t.score + 1 };
        }
        return t;
      });

      // Then move the active task
      return updatedTasks.map(t =>
        t.id === taskId
          ? { ...t, relatedColumn: targetColumn, score: targetScore }
          : t
      );
    });

    toast.success(`Moved "${task.name}" to ${targetColumn.name}`);
  };

  // Reorder tasks within the same column
  const reorderTasksInColumn = (columnId: number, activeIndex: number, overIndex: number): void => {
    const columnTasks = tasks
      .filter(task => task.relatedColumn.id === columnId)
      .sort((a, b) => a.score - b.score);

    if (activeIndex === overIndex) return;

    const reorderedTasks = arrayMove(columnTasks, activeIndex, overIndex);

    // Update the score of all tasks in the column
    setTasks(prevTasks =>
      prevTasks.map(task => {
        if (task.relatedColumn.id === columnId) {
          const newIndex = reorderedTasks.findIndex(t => t.id === task.id);
          return newIndex !== -1 ? { ...task, score: newIndex } : task;
        }
        return task;
      })
    );

    const movedTask = columnTasks[activeIndex];
    toast.success(`Reordered "${movedTask.name}" within ${movedTask.relatedColumn.name}`);
  };

  // Handle drag start event
  const handleDragStart = (event: DragStartEvent): void => {
    const { active } = event;
    const taskData = active.data.current;

    if (taskData?.type === 'task') {
      setActiveTask(taskData.task);
    }
  };

  // Handle drag end event
  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event;

    if (!over || !activeTask) {
      setActiveTask(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if we're dropping over a column or task
    const overData = over.data.current;
    const activeData = active.data.current;

    if (!activeData?.task) {
      setActiveTask(null);
      return;
    }

    const draggedTask = activeData.task as Task;

    // If dropping over a column (moving between columns)
    if (overData?.type === 'column') {
      const targetColumn = overData.column;

      if (draggedTask.relatedColumn.id !== targetColumn.id) {
        moveTaskToColumn(draggedTask.id, targetColumn);
      }
    }
    // If dropping over a task (reordering within the same column or moving between columns)
    else if (overData?.type === 'task') {
      const overTask = overData.task as Task;

      // Only reorder if in the same column
      if (draggedTask.relatedColumn.id === overTask.relatedColumn.id && activeId !== overId) {
        const columnTasks = getTasksForColumn(draggedTask.relatedColumn);
        const activeIndex = columnTasks.findIndex(task => task.id === draggedTask.id);
        const overIndex = columnTasks.findIndex(task => task.id === overTask.id);

        if (activeIndex !== -1 && overIndex !== -1) {
          reorderTasksInColumn(draggedTask.relatedColumn.id, activeIndex, overIndex);
        }
      }
      // Moving to a different column by dropping on a task
      else if (draggedTask.relatedColumn.id !== overTask.relatedColumn.id) {
        const targetColumn = overTask.relatedColumn;
        const targetScore = overTask.score;

        moveTaskToPosition(draggedTask.id, targetColumn, targetScore);
      }
    }

    setActiveTask(null);
  };

  // Add a new task
  const addTask = (taskData: Omit<Task, 'id' | 'score'>): void => {
    const columnTasks = getTasksForColumn(taskData.relatedColumn);
    const newScore = columnTasks.length > 0 ? Math.max(...columnTasks.map(t => t.score)) + 1 : 0;

    const newTask: Task = {
      ...taskData,
      id: generateTaskId(),
      score: newScore,
    };

    setTasks(prevTasks => [...prevTasks, newTask]);
    toast.success(`Added "${newTask.name}" to ${newTask.relatedColumn.name}`);
  };

  // Delete a task
  const deleteTask = (taskId: number): void => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    setTasks(prevTasks => prevTasks.filter(t => t.id !== taskId));
    toast.success(`Deleted "${task.name}"`);
  };

  // Update a task
  const updateTask = (taskId: number, updates: Partial<Task>): void => {
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId ? { ...task, ...updates } : task
      )
    );

    const task = tasks.find(t => t.id === taskId);
    if (task) {
      toast.success(`Updated "${task.name}"`);
    }
  };

  // Add a new column
  const addColumn = (columnData: Omit<TaskColumn, 'id'>): void => {
    const newColumn: TaskColumn = {
      ...columnData,
      id: generateColumnId(),
    };

    setColumns(prevColumns => [...prevColumns, newColumn]);
    toast.success(`Added column "${newColumn.name}"`);
  };

  // Add a column between existing columns
  const addColumnBetween = (afterColumnId: number, columnData: Omit<TaskColumn, 'id' | 'score'>): void => {
    const afterColumn = columns.find(c => c.id === afterColumnId);
    if (!afterColumn) return;

    // Get the next column's score to calculate the new score
    const sortedColumns = [...columns].sort((a, b) => a.score - b.score);
    const afterIndex = sortedColumns.findIndex(c => c.id === afterColumnId);
    const nextColumn = sortedColumns[afterIndex + 1];
    
    // Calculate score between the two columns
    const newScore = nextColumn 
      ? (afterColumn.score + nextColumn.score) / 2 
      : afterColumn.score + 1;

    const newColumn: TaskColumn = {
      ...columnData,
      id: generateColumnId(),
      score: newScore,
    };

    setColumns(prevColumns => [...prevColumns, newColumn]);
    toast.success(`Added column "${newColumn.name}" after "${afterColumn.name}"`);
  };

  // Delete a column
  const deleteColumn = (columnId: number): void => {
    const column = columns.find(c => c.id === columnId);
    if (!column) return;

    // Move all tasks from this column to the first available column
    const remainingColumns = columns.filter(c => c.id !== columnId);
    if (remainingColumns.length > 0) {
      const firstColumn = remainingColumns.sort((a, b) => a.score - b.score)[0];
      const tasksToMove = tasks.filter(t => t.relatedColumn.id === columnId);
      
      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.relatedColumn.id === columnId
            ? { ...task, relatedColumn: firstColumn }
            : task
        )
      );

      if (tasksToMove.length > 0) {
        toast.success(`Moved ${tasksToMove.length} tasks to "${firstColumn.name}"`);
      }
    }

    setColumns(prevColumns => prevColumns.filter(c => c.id !== columnId));
    toast.success(`Deleted column "${column.name}"`);
  };

  // Update a column
  const updateColumn = (columnId: number, updates: Partial<TaskColumn>): void => {
    setColumns(prevColumns =>
      prevColumns.map(column =>
        column.id === columnId ? { ...column, ...updates } : column
      )
    );

    const column = columns.find(c => c.id === columnId);
    if (column) {
      toast.success(`Updated column "${column.name}"`);
    }
  };

  return {
    tasks,
    columns,
    activeTask,
    handleDragStart,
    handleDragEnd,
    getTasksForColumn,
    moveTaskToColumn,
    addTask,
    deleteTask,
    updateTask,
    addColumn,
    deleteColumn,
    updateColumn,
    addColumnBetween,
  };
}
