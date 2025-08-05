import type {TaskColumn, Task} from "@/types";
import {BoardHeader} from "@/components/custom/kanban/board-header";
import {KanbanColumn} from "@/components/custom/kanban/kanban-column";
import {AddColumnButton} from "@/components/custom/kanban/add-column-button";
import {mockColumns, mockTasks as initialTasks} from "@/lib/mock-data";
import {useState} from "react";
import {DndContext, DragOverlay} from '@dnd-kit/core';
import type {DragEndEvent, DragStartEvent} from '@dnd-kit/core';
import {TaskCard} from "@/components/custom/kanban/task-card";

export function IssuesBoardPage() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [lastMoveMessage, setLastMoveMessage] = useState<string | null>(null);

  const getTasksForColumn = (column: TaskColumn) => {
    return tasks.filter(task => task.relatedColumn.id === column.id);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const taskData = active.data.current;
    
    if (taskData?.type === 'task') {
      setActiveTask(taskData.task);
      setLastMoveMessage(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || !activeTask) {
      setActiveTask(null);
      return;
    }

    const overData = over.data.current;
    
    if (overData?.type === 'column') {
      const targetColumn = overData.column;
      
      if (activeTask.relatedColumn.id !== targetColumn.id) {
        setTasks(prevTasks => 
          prevTasks.map(task => 
            task.id === activeTask.id 
              ? { ...task, relatedColumn: targetColumn }
              : task
          )
        );
        
        // Show success message
        setLastMoveMessage(`Moved "${activeTask.name}" to ${targetColumn.name}`);
        
        // Clear message after 3 seconds
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
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
            <TaskCard task={activeTask} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
