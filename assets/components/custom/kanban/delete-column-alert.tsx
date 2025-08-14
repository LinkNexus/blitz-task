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
import {apiFetch} from "@/lib/fetch.ts";
import {toast} from "sonner";

export function DeleteColumnAlert({
  column,
  isOpen,
  onClose
}: { column: TaskColumn, isOpen: boolean, onClose: () => void }) {
  const {deleteColumn} = useAppStore(state => state);

  async function handleDelete() {
    deleteColumn(column.id);
    onClose();

    await apiFetch(`/api/columns/${column.id}`, {
      method: "DELETE",
    })
      .then(() => {
        toast.success(`The column "${column.name}" was deleted successfully`);
      })
      .catch(err => {
        console.log("An error occurred when deleting column: ", err);
        toast.error(`An error occurred when deleting column "${column.name}"`);
      });
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
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => handleDelete()}>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
