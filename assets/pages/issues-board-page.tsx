import {BoardHeader} from "@/components/custom/kanban/board-header";
import {KanbanColumn} from "@/components/custom/kanban/kanban-column";
import {AddColumnButton} from "@/components/custom/kanban/add-column-button";
import {mockColumns, mockTasks as initialTasks} from "@/lib/mock-data";
import {closestCenter, DndContext, DragOverlay} from '@dnd-kit/core';
import {TaskCard} from "@/components/custom/kanban/task-card";
import {useKanbanDragDrop} from "@/hooks/useKanbanDragDrop.ts";
import {memo} from "react";
import {useAppStore} from "@/lib/store.ts";

export const IssuesBoardPage = memo(function () {
  const {
    activeProjectId,
    teams
  } = useAppStore(state => state);
  const project = teams.flatMap(t => t.projects)
    .find(p => p?.id === activeProjectId);

  console.log({
    activeProjectId,
    project,
    teams
  });

  const {
    tasks,
    columns,
    activeTask,
    handleDragStart,
    handleDragEnd,
    getTasksForColumn,
    addTask,
    deleteTask,
    updateTask,
    addColumn,
    deleteColumn,
    updateColumn,
    addColumnBetween,
  } = useKanbanDragDrop({initialTasks, initialColumns: mockColumns});

  const handleAddTask = () => {
    // TODO: Implement add task functionality using the addTask function
    console.log("Add task clicked");
    // Example usage:
    // addTask({
    //   name: "New Task",
    //   description: "Task description",
    //   priority: "medium",
    //   relatedColumn: mockColumns[0],
    //   labels: [],
    //   assignees: [],
    //   dueAt: new Date().toISOString(), // Can be null or a date string
    //   createdAt: new Date().toISOString(),
    // });
  };

  const handleFilter = () => {
    // TODO: Implement filter functionality
    console.log("Filter clicked");
  };

  const handleAddColumnBetween = (afterColumnId: number) => {
    // TODO: Implement add column between functionality
    addColumnBetween(afterColumnId, {
      name: "New Column",
      color: "#6b7280", // Default color
    });
  };

  const handleTaskEdit = (taskId: number) => {
    // TODO: Implement task editing using updateTask function
    console.log("Edit task:", taskId);
  };

  const handleTaskDelete = (taskId: number) => {
    deleteTask(taskId);
  };

  // if (!project) {
  //   return <Redirect to={"/dashboard"}/>
  // }

  return (
    <DndContext
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      collisionDetection={closestCenter}
    >
      <div className="space-y-4 sm:space-y-6">
        <BoardHeader onAddTask={handleAddTask} onFilter={handleFilter}/>

        {/* Kanban Board */}
        <div className="flex gap-3 sm:gap-6 min-h-[500px] sm:min-h-[600px] overflow-x-auto pb-4">
          {[...columns].sort((a, b) => a.score - b.score).map((column) => {
            const tasks = getTasksForColumn(column);
            return (
              <KanbanColumn
                key={column.id}
                column={column}
                tasks={tasks}
                onAddColumnBetween={handleAddColumnBetween}
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
});
