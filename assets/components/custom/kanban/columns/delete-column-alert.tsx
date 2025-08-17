import type {TaskColumn} from "@/types.ts";
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
import {toast} from "sonner";
import {useApiFetch} from "@/hooks/useApiFetch.ts";

export function DeleteColumnAlert({
  column,
  isOpen,
  onClose
}: { column: TaskColumn, isOpen: boolean, onClose: () => void }) {
  const deleteColumn = useAppStore(state => state.deleteColumn);

  const {pending, callback: deleteColumnRequest} = useApiFetch(`/api/columns/${column.id}`, {
    method: "DELETE",
    onSuccess() {
      toast.success(`The column "${column.name}" was deleted successfully`);
      onClose();
    },
    onError(err) {
      console.log("An error occurred when deleting column: ", err);
      toast.error(`An error occurred when deleting column "${column.name}"`);
    }
  });

  async function handleDelete() {
    deleteColumn(column.id);
    await deleteColumnRequest();
  }

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to delete column {column.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. All tasks in this column will be deleted.
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
