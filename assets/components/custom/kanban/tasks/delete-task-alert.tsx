import type {Task} from "@/types.ts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog.tsx";
import {useAppStore} from "@/lib/store.ts";
import {useApiFetch} from "@/hooks/useFetch.ts";
import {toast} from "sonner";

interface DeleteTaskAlertProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
}

export function DeleteTaskAlert({
  task,
  isOpen,
  onClose
}: DeleteTaskAlertProps) {
  const deleteTask = useAppStore(state => state.deleteTask);

  const {pending, callback: deleteTaskCallback} = useApiFetch(`/api/tasks/${task.id}`, {
    method: "DELETE",
    onSuccess() {
      toast.success(`The task ${task.name} was deleted successfully`);
      onClose();
    },
    onError(err) {
      console.log("An error occurred when deleting task: ", err);
      toast.error(`An error occurred when deleting task ${task.id}`);
    }
  })

  async function handleDelete() {
    deleteTask(task.id);
    await deleteTaskCallback();
  }

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to delete task {task.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. All comments and attachments related to this task will be deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={() => handleDelete()}>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
