import type {BoardFilters} from "@/components/custom/kanban/board-header.tsx";
import {BoardHeader} from "@/components/custom/kanban/board-header.tsx";
import {DragAndDropProvider} from "@/components/custom/kanban/drag-and-drop-provider.tsx";
import {KanbanBoard} from "@/components/custom/kanban/kanban-board.tsx";
import {TaskModal} from "@/components/custom/kanban/tasks/modal/task-modal.tsx";
import {useTaskView} from "@/components/custom/kanban/tasks/view/task-view-modal.tsx";
import {useTaskFilters} from "@/hooks/useTaskFilters.ts";
import {useTaskModal} from "@/hooks/useTaskModal.ts";
import type {Project, TaskColumn, Team} from "@/types.ts";

interface BoardContentProps {
  team: Team;
  project: Project;
  columns: TaskColumn[];
  filters: BoardFilters;
  setFilters: (filters: BoardFilters) => void;
}

export function BoardContent({team, project, columns, filters, setFilters}: BoardContentProps) {
  const {
    isTaskModalOpen,
    currentTask,
    defaultColumnId,
    openCreateTaskModal,
    openEditTaskModal,
    closeTaskModal,
  } = useTaskModal();

  const {
    openTaskView,
    TaskViewModal: TaskViewComponent
  } = useTaskView();

  const {
    availableUsers,
    availableLabels,
    allTasks,
    filteredTasks,
    getFilteredTasksForColumn,
  } = useTaskFilters(columns, filters);

  return (
    <DragAndDropProvider
      columns={columns}
      project={project}
    >
      <div className="space-y-4 sm:space-y-6">
        <BoardHeader
          onAddTask={() => {
            const firstColumn = columns?.[0];
            if (firstColumn) {
              openCreateTaskModal(firstColumn.id);
            }
          }}
          filters={filters}
          onFiltersChange={setFilters}
          availableUsers={availableUsers}
          availableLabels={availableLabels}
          totalTasks={allTasks.length}
          filteredTasks={filteredTasks.length}
        />

        <KanbanBoard
          columns={columns}
          project={project}
          getFilteredTasksForColumn={getFilteredTasksForColumn}
          onAddTask={openCreateTaskModal}
          onEditTask={openEditTaskModal}
          onViewTask={openTaskView}
        />
      </div>

      {/* Task Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={closeTaskModal}
        task={currentTask}
        columns={columns || []}
        defaultColumnId={defaultColumnId}
        teamMembers={team.members}
      />

      {/* Task View Modal */}
      <TaskViewComponent/>
    </DragAndDropProvider>
  );
}
