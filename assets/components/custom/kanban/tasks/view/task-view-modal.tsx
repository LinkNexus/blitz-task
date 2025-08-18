import {Button} from "@/components/ui/button.tsx";
import {ArrowLeft, Settings} from "lucide-react";
import {TaskHeader} from "@/components/custom/kanban/tasks/view/task-header.tsx";
import {TaskDetails} from "@/components/custom/kanban/tasks/view/task-details.tsx";
import {TaskAttachments} from "@/components/custom/kanban/tasks/view/task-attachments.tsx";
import {TaskComments} from "@/components/custom/kanban/tasks/view/task-comments.tsx";
import {useSearchParams} from "wouter";
import {useAppStore} from "@/lib/store.ts";
import {memo} from "react";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {TaskViewPriorityDueDate} from "@/components/custom/kanban/tasks/view/task-view-priority-due-date.tsx";
import {TaskViewAssignees} from "@/components/custom/kanban/tasks/view/task-view-assignees.tsx";
import {TaskViewLabels} from "@/components/custom/kanban/tasks/view/task-view-labels.tsx";

export const TaskViewModal = memo(function ({taskId}: { taskId: number }) {
  const [_, setParams] = useSearchParams();
  const {teams, activeTeamId, updateTask} = useAppStore(state => state);
  const team = teams.find(t => t.id === activeTeamId);
  const task = team?.projects
    ?.flatMap(p => p?.columns)
    .flatMap(c => c?.tasks)
    .find(t => t?.id === taskId);

  function handleGoBack() {
    setParams(prev => {
      prev.delete("taskId");
      return prev;
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed inset-y-0 right-0 w-full max-w-7xl bg-background shadow-lg overflow-auto">
        <div className="sticky top-0 bg-background border-b p-4 z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGoBack}
          >
            <ArrowLeft className="w-4 h-4 mr-2"/>
            Back to Board
          </Button>
        </div>
        <div className="p-4">
          {!task && (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-destructive mb-2">
                  Task not found
                </h2>
                <p className="text-muted-foreground mb-4">
                  The task you're looking for doesn't exist or couldn't be loaded.
                </p>
                <Button onClick={handleGoBack} variant="outline">
                  <ArrowLeft className="w-4 h-4 mr-2"/>
                  Go Back
                </Button>
              </div>
            </div>
          )}

          {task && (
            <div className="container mx-auto px-4 py-6 max-w-7xl">
              {/* Header with back button */}
              <div className="mb-6">
                <TaskHeader
                  task={task}
                  onTaskUpdate={updateTask}
                />
              </div>

              {/* Main content layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main content */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Task details */}
                  <TaskDetails
                    task={task}
                    onTaskUpdate={console.log}
                  />

                  {/* Attachments */}
                  <TaskAttachments
                    task={task}
                    onAttachmentAdd={console.log}
                    onAttachmentDelete={console.log}
                  />

                  {/* Comments */}
                  <TaskComments
                    task={task}
                    onCommentAdd={console.log}
                    onCommentUpdate={console.log}
                    onCommentDelete={console.log}
                  />
                </div>

                {/* Sidebar */}
                <div className="lg:col-span-1">
                  <div className="space-y-4">
                    {/* Task Settings */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Settings className="w-5 h-5"/>
                          Task Settings
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <TaskViewPriorityDueDate
                          id={task.id}
                          priority={task.priority}
                          dueAt={task.dueAt}
                          onUpdate={function ({priority, dueAt}) {
                            updateTask({
                              ...task,
                              priority,
                              dueAt
                            })
                          }}
                        />
                      </CardContent>
                    </Card>

                    <TaskViewAssignees
                      id={task.id}
                      assignees={task.assignees}
                      onAssigneeAdd={function (user) {
                        updateTask({
                          ...task,
                          assignees: [...task.assignees, user]
                        })
                      }}
                      onAssigneeRemove={function (userId) {
                        updateTask({
                          ...task,
                          assignees: task.assignees.filter(u => u.id === userId)
                        })
                      }}
                      teamMembers={team?.members || []}
                    />

                    <TaskViewLabels
                      id={task.id}
                      labels={task.labels}
                      onLabelAdd={function (label) {
                        updateTask({
                          ...task,
                          labels: [...task.labels, label]
                        })
                      }}
                      onLabelRemove={function (labelId) {
                        updateTask({
                          ...task,
                          labels: task.labels.filter(l => l.id === labelId)
                        })
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
