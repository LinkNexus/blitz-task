import {Button} from "@/components/ui/button.tsx";
import {ArrowLeft, Settings} from "lucide-react";
import {TaskHeader} from "@/components/custom/kanban/tasks/view/task-header.tsx";
import {TaskDetails} from "@/components/custom/kanban/tasks/view/task-details.tsx";
import {TaskViewAttachments} from "@/components/custom/kanban/tasks/view/task-view-attachments.tsx";
import {TaskViewComments} from "@/components/custom/kanban/tasks/view/task-view-comments.tsx";
import {useSearchParams} from "wouter";
import {useAppStore} from "@/lib/store.ts";
import {memo} from "react";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {TaskViewPriorityDueDate} from "@/components/custom/kanban/tasks/view/task-view-priority-due-date.tsx";
import {TaskViewAssignees} from "@/components/custom/kanban/tasks/view/task-view-assignees.tsx";
import {TaskViewLabels} from "@/components/custom/kanban/tasks/view/task-view-labels.tsx";

export const TaskViewModal = memo(function ({taskId}: { taskId: number }) {
  const [_, setParams] = useSearchParams();
  const {
    updateTask,
    getTask,
    getActiveTeam,
  } = useAppStore(state => state);
  const team = getActiveTeam();
  const task = getTask(taskId);

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
                  />

                  {/* Attachments */}
                  <TaskViewAttachments
                    id={task.id}
                    attachments={task.attachments}
                    onAttachmentAdd={function (attachment) {
                      if (!task.attachments.some(a => a.id === attachment.id)) {
                        updateTask({
                          ...task,
                          attachments: [...task.attachments, attachment]
                        })
                      }
                    }}
                    onAttachmentDelete={function (attachmentId) {
                      updateTask({
                        ...task,
                        attachments: task.attachments.filter(a => a.id !== attachmentId)
                      })
                    }}
                  />

                  {/* Comments */}
                  <TaskViewComments
                    id={task.id}
                    comments={task.comments}
                    onCommentAdd={function (comment) {
                      if (!task.comments?.some(c => c.id === comment.id)) {
                        updateTask({
                          ...task,
                          comments: [...(task?.comments || []), comment]
                        })
                      }
                    }}
                    onCommentUpdate={function (comment) {
                      updateTask({
                        ...task,
                        comments: task.comments?.map(c => c.id === comment.id ? comment : c)
                      })
                    }}
                    onCommentDelete={function (commentId) {
                      updateTask({
                        ...task,
                        comments: task.comments?.filter(c => c.id !== commentId)
                      })
                    }}
                    onCommentsFetch={function (comments) {
                      updateTask({
                        ...task,
                        comments
                      });
                    }}
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
                        if (!task.labels.some(l => l.id === label.id)) {
                          updateTask({
                            ...task,
                            labels: [...task.labels, label]
                          })
                        }
                      }}
                      onLabelRemove={function (labelId) {
                        updateTask({
                          ...task,
                          labels: task.labels.filter(l => l.id !== labelId)
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
