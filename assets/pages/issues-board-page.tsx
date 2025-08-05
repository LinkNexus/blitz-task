import type {TaskColumn} from "@/types";
import {BoardHeader} from "@/components/custom/kanban/board-header";
import {KanbanColumn} from "@/components/custom/kanban/kanban-column";
import {AddColumnButton} from "@/components/custom/kanban/add-column-button";
import {mockColumns, mockTasks} from "@/lib/mock-data";

export function IssuesBoardPage() {
  const getTasksForColumn = (column: TaskColumn) => {
    return mockTasks.filter(task => task.relatedColumn.id === column.id);
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
    <div className="space-y-4 sm:space-y-6">
      <BoardHeader onAddTask={handleAddTask} onFilter={handleFilter}/>

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
  );
}
