import type {Task, TaskColumn} from "@/types";
import {BoardHeader} from "@/components/custom/kanban/board-header";
import {KanbanColumn} from "@/components/custom/kanban/kanban-column";
import {AddColumnButton} from "@/components/custom/kanban/add-column-button";
import {mockColumns, mockTasks as initialTasks} from "@/lib/mock-data";
import {useState} from "react";
import type {DragEndEvent, DragStartEvent} from '@dnd-kit/core';
import {closestCenter, DndContext, DragOverlay} from '@dnd-kit/core';
import {arrayMove} from '@dnd-kit/sortable';
import {TaskCard} from "@/components/custom/kanban/task-card";

export function IssuesBoardPage() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [lastMoveMessage, setLastMoveMessage] = useState<string | null>(null);

  const getTasksForColumn = (column: TaskColumn) => {
    return tasks
      .filter(task => task.relatedColumn.id === column.id)
      .sort((a, b) => a.order - b.order);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const {active} = event;
    const taskData = active.data.current;

    if (taskData?.type === 'task') {
      setActiveTask(taskData.task);
      setLastMoveMessage(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const {active, over} = event;

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
        // Moving to a different column
        const targetColumnTasks = getTasksForColumn(targetColumn);
        const newOrder = targetColumnTasks.length;

        setTasks(prevTasks =>
          prevTasks.map(task =>
            task.id === draggedTask.id
              ? {...task, relatedColumn: targetColumn, order: newOrder}
              : task
          )
        );

        setLastMoveMessage(`Moved "${draggedTask.name}" to ${targetColumn.name}`);
        setTimeout(() => setLastMoveMessage(null), 3000);
      }
    }
    // If dropping over a task (reordering within the same column)
    else if (overData?.type === 'task') {
      const overTask = overData.task as Task;

      // Only reorder if in the same column
      if (draggedTask.relatedColumn.id === overTask.relatedColumn.id && activeId !== overId) {
        const columnTasks = getTasksForColumn(draggedTask.relatedColumn);
        const activeIndex = columnTasks.findIndex(task => task.id === draggedTask.id);
        const overIndex = columnTasks.findIndex(task => task.id === overTask.id);

        if (activeIndex !== overIndex) {
          const reorderedTasks = arrayMove(columnTasks, activeIndex, overIndex);

          // Update the order of all tasks in the column
          setTasks(prevTasks =>
            prevTasks.map(task => {
              if (task.relatedColumn.id === draggedTask.relatedColumn.id) {
                const newIndex = reorderedTasks.findIndex(t => t.id === task.id);
                return newIndex !== -1 ? {...task, order: newIndex} : task;
              }
              return task;
            })
          );

          setLastMoveMessage(`Reordered "${draggedTask.name}" within ${draggedTask.relatedColumn.name}`);
          setTimeout(() => setLastMoveMessage(null), 3000);
        }
      }
      // Moving to a different column by dropping on a task
      else if (draggedTask.relatedColumn.id !== overTask.relatedColumn.id) {
        const targetColumn = overTask.relatedColumn;
        const targetColumnTasks = getTasksForColumn(targetColumn);
        const overIndex = targetColumnTasks.findIndex(task => task.id === overTask.id);

        // Insert at the position of the task we're dropping on
        setTasks(prevTasks => {
          // First, update orders in the target column to make space
          const updatedTasks = prevTasks.map(task => {
            if (task.relatedColumn.id === targetColumn.id && task.order >= overIndex) {
              return {...task, order: task.order + 1};
            }
            return task;
          });

          // Then move the active task
          return updatedTasks.map(task =>
            task.id === draggedTask.id
              ? {...task, relatedColumn: targetColumn, order: overIndex}
              : task
          );
        });

        setLastMoveMessage(`Moved "${draggedTask.name}" to ${targetColumn.name}`);
        setTimeout(() => setLastMoveMessage(null), 3000);
      }
    }

    setActiveTask(null);
  };

  const handleAddTask = () => {
    // TODO: Implement add task functionality
    console.log("Add task clicked");
  };

  const handleFilter = () => {
    // TODO: Implement filter functionality
    console.log("Filter clicked");
  };

  return (
    <DndContext
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      collisionDetection={closestCenter}
    >
      <div className="space-y-4 sm:space-y-6">
        <BoardHeader onAddTask={handleAddTask} onFilter={handleFilter}/>

        {/* Success Message */}
        {lastMoveMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative">
            <span className="block sm:inline">{lastMoveMessage}</span>
          </div>
        )}

        {/* Kanban Board */}
        <div className="flex gap-3 sm:gap-6 min-h-[500px] sm:min-h-[600px] overflow-x-auto pb-4">
          {mockColumns.map((column) => {
            const tasks = getTasksForColumn(column);
            return (
              <KanbanColumn
                key={column.id}
                column={column}
                tasks={tasks}
              />
            );
          })}

          <AddColumnButton/>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeTask && (
          <div className="rotate-3 opacity-90">
            <TaskCard task={activeTask}/>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
