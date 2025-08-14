import {z} from "zod";
import type {Project, TaskColumn} from "@/types.ts";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog.tsx";
import {apiFetch} from "@/lib/fetch.ts";
import {useAppStore} from "@/lib/store.ts";
import {toast} from "sonner";
import {Form, FormControl, FormField, FormItem, FormLabel, FormMessage} from "@/components/ui/form.tsx";
import {Input} from "@/components/ui/input.tsx";
import {Button} from "@/components/ui/button";
import {Loader2} from "lucide-react";
import {useEffect} from "react";

const columnSchema = z.object({
  name: z.string().min(2, {message: "Column name must be at least 2 characters long."}),
  color: z.string().regex(
    /^#[0-9a-fA-F]{6}$/,
    {message: 'Invalid color format. Must be a 7-character hex code (e.g., #RRGGBB).'}
  ),
});

type ColumnFormData = z.infer<typeof columnSchema>;

interface ColumnModalProps {
  isOpen: boolean;
  onClose: () => void;
  column: TaskColumn | null;
  score: number;
  project: Project;
}

export function ColumnModal({
  isOpen,
  onClose,
  column,
  score,
  project
}: ColumnModalProps) {
  const isEditing = !!column;
  const form = useForm<ColumnFormData>({
    resolver: zodResolver(columnSchema),
    defaultValues: {
      name: column?.name || "",
      color: column?.color || "#000000",
    }
  });
  const {
    handleSubmit,
    formState: {isSubmitting},
    reset,
  } = form;
  const {addColumn, updateColumn} = useAppStore(state => state);


  useEffect(() => {
    if (isOpen) {
      reset({
        name: column?.name || "",
        color: column?.color || "#000000",
      });
    }
  }, [isOpen, column, reset]);

  function handleClose() {
    reset({
      name: column?.name || "",
      color: column?.color || "#000000",
    });
    onClose();
  }

  async function onSubmit(data: ColumnFormData) {
    console.log("Submitting form data:", data);
    try {
      const createdOrUpdatedColumn = await apiFetch<TaskColumn>(
        isEditing ? `/api/columns/${column.id}` : "/api/columns",
        {
          method: isEditing ? "PUT" : "POST",
          data: {
            ...data,
            score: column?.score || score,
            projectId: project.id,
          }
        }
      );

      if (isEditing) {
        updateColumn(createdOrUpdatedColumn);
        toast.success(
          `Column "${createdOrUpdatedColumn.name}" updated successfully`
        );
      } else {
        addColumn(project.id, createdOrUpdatedColumn);
        toast.success(
          `Column "${createdOrUpdatedColumn.name}" created successfully`
        );
      }

      onClose();
    } catch (err) {
      console.error("Failed to save column:", err);
      toast.error(
        isEditing ? "Failed to update column" : "Failed to create column"
      );
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Task" : "Create New Task"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the task details below."
              : "Fill in the details to create a new task."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              name="name"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Column Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter column name..." {...field} />
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )}
            />

            <FormField
              name="color"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Column Color *</FormLabel>
                  <FormControl>
                    <Input type={"color"} placeholder="Enter column color..." {...field} />
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={console.log} type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                )}
                {isEditing ? "Update Column" : "Create Column"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
