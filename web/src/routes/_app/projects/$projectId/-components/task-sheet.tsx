import { zodResolver } from "@hookform/resolvers/zod";
import {
  IconDownload,
  IconEye,
  IconFile,
  IconFileText,
  IconFileZip,
  IconMusic,
  IconPhoto,
  IconVideo,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Controller, type Resolver, useForm } from "react-hook-form";
import { toast } from "sonner";
import type z from "zod";
import type {
  AttachmentMetadata,
  ProjectDetails,
  ProjectTaskDetails,
} from "@/api";
import {
  createProjectTaskMutation,
  getProjectQueryKey,
  updateProjectTaskMutation,
} from "@/api/@tanstack/react-query.gen";
import { aspNetFormSerializer } from "@/lib/form-serializer";
import { DatePickerField } from "@/components/forms/fields/date-picker";
import { DropzoneField } from "@/components/forms/fields/dropzone";
import { InputField } from "@/components/forms/fields/input";
import { TextCollectionField } from "@/components/forms/fields/text-collection";
import { MarkdownField } from "@/components/forms/fields/markdown";
import { TextareaField } from "@/components/forms/fields/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { getInitials } from "@/lib/utils";
import { TaskSchema } from "../-schemas";

type FormValues = z.infer<typeof TaskSchema>;

type Props = {
  project: ProjectDetails;
};

function getAttachmentIcon(contentType: string) {
  if (contentType.startsWith("image/")) return IconPhoto;
  if (contentType.startsWith("video/")) return IconVideo;
  if (contentType.startsWith("audio/")) return IconMusic;
  if (contentType === "application/pdf") return IconFileText;
  if (
    contentType === "application/zip" ||
    contentType === "application/x-tar" ||
    contentType === "application/x-rar-compressed" ||
    contentType === "application/gzip"
  )
    return IconFileZip;
  if (contentType.startsWith("text/")) return IconFileText;
  return IconFile;
}

function ExistingAttachmentItem({
  attachment,
  projectId,
  onRemove,
}: {
  attachment: AttachmentMetadata;
  projectId: number;
  onRemove: () => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const url = `/api/projects/${projectId}/attachments/${attachment.id}`;
  const isImage = attachment.contentType.startsWith("image/");
  const isVideo = attachment.contentType.startsWith("video/");
  const canPreview = isImage || isVideo;
  const AttachIcon = getAttachmentIcon(attachment.contentType);

  return (
    <>
      <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
        {isImage ? (
          <img
            src={url}
            alt={attachment.originalFileName}
            className="size-8 shrink-0 rounded object-cover"
          />
        ) : (
          <AttachIcon className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="flex-1 truncate text-sm">
          {attachment.originalFileName}
        </span>
        <Badge variant="outline" className="text-[10px] shrink-0">
          {(Number(attachment.sizeInBytes) / 1024).toFixed(0)} KB
        </Badge>
        {canPreview && (
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Preview"
          >
            <IconEye className="size-4" />
          </button>
        )}
        <a
          href={url}
          download={attachment.originalFileName}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Download"
        >
          <IconDownload className="size-4" />
        </a>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
          aria-label="Remove"
        >
          <IconX className="size-4" />
        </button>
      </div>

      {canPreview && (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="truncate">
                {attachment.originalFileName}
              </DialogTitle>
            </DialogHeader>
            {isImage && (
              <img
                src={url}
                alt={attachment.originalFileName}
                className="max-h-[70vh] w-full rounded object-contain"
              />
            )}
            {isVideo && (
              <video
                src={url}
                controls
                className="max-h-[70vh] w-full rounded"
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

const FORM_ID = "task-sheet-form";

const EMPTY_DEFAULTS: FormValues = {
  name: "",
  description: "",
  priority: "MEDIUM",
  tags: [],
  startDate: null,
  dueDate: null,
  assigneeIds: [],
  newAttachments: [],
  removedAttachmentIds: [],
};

export function TaskSheet({ project }: Props) {
  const [open, setOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTaskDetails | null>(
    null,
  );
  const [columnId, setColumnId] = useState<number | null>(null);
  const [existingAttachments, setExistingAttachments] = useState<
    AttachmentMetadata[]
  >([]);
  const queryClient = useQueryClient();

  const defaultColumnId = Number(
    [...project.columns].sort((a, b) => Number(a.score) - Number(b.score))[0]
      ?.id ?? 0,
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(TaskSchema) as Resolver<FormValues>,
    defaultValues: EMPTY_DEFAULTS,
  });

  useEffect(() => {
    const onCreateEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ columnId?: number }>).detail;
      setEditingTask(null);
      setExistingAttachments([]);
      setColumnId(detail?.columnId ?? defaultColumnId);
      form.reset(EMPTY_DEFAULTS);
      setOpen(true);
    };
    const onUpdateEvent = (e: Event) => {
      const task = (e as CustomEvent<ProjectTaskDetails>).detail;
      setEditingTask(task);
      setExistingAttachments(task.attachments ?? []);
      setColumnId(null);
      form.reset({
        ...EMPTY_DEFAULTS,
        name: task.name,
        description: task.description ?? "",
        priority: task.priority,
        tags: task.tags ?? [],
        startDate: task.startDate ?? null,
        dueDate: task.dueDate ?? null,
        assigneeIds: (task.assigneeIds ?? []).map(Number),
      });
      setOpen(true);
    };
    document.addEventListener("task.create", onCreateEvent);
    document.addEventListener("task.update", onUpdateEvent);
    return () => {
      document.removeEventListener("task.create", onCreateEvent);
      document.removeEventListener("task.update", onUpdateEvent);
    };
  }, [defaultColumnId, form]);

  const createTask = useMutation({
    ...createProjectTaskMutation(),
    onSuccess: (created: ProjectTaskDetails) => {
      const targetColumnId = columnId ?? defaultColumnId;
      queryClient.setQueryData(
        getProjectQueryKey({ path: { projectId: Number(project.id) } }),
        (old: ProjectDetails): ProjectDetails => ({
          ...old,
          columns: old.columns.map((col) =>
            Number(col.id) === targetColumnId
              ? { ...col, tasks: [...col.tasks, created] }
              : col,
          ),
        }),
      );
      toast.success("Task created");
      setOpen(false);
    },
    onError: () => toast.error("Failed to create task"),
  });

  const updateTask = useMutation({
    ...updateProjectTaskMutation(),
    onSuccess: (updated: ProjectTaskDetails) => {
      queryClient.setQueryData(
        getProjectQueryKey({ path: { projectId: Number(project.id) } }),
        (old: ProjectDetails): ProjectDetails => ({
          ...old,
          columns: old.columns.map((col) => ({
            ...col,
            tasks: col.tasks.map((t) =>
              Number(t.id) === Number(updated.id) ? updated : t,
            ),
          })),
        }),
      );
      toast.success("Task updated");
      setOpen(false);
    },
    onError: () => toast.error("Failed to update task"),
  });

  const isPending = createTask.isPending || updateTask.isPending;

  const onSubmit = (data: FormValues) => {
    const commonFields = {
      name: data.name,
      description: data.description,
      priority: data.priority,
      tags: data.tags,
      startDate: data.startDate,
      dueDate: data.dueDate,
      assigneeIds: data.assigneeIds,
    };

    if (editingTask) {
      updateTask.mutate({
        bodySerializer: aspNetFormSerializer,
        body: {
          ...commonFields,
          newAttachments:
            data.newAttachments.length > 0 ? data.newAttachments : undefined,
          removedAttachmentIds:
            data.removedAttachmentIds.length > 0
              ? data.removedAttachmentIds
              : undefined,
        },
        path: { projectId: Number(project.id), taskId: Number(editingTask.id) },
      });
    } else {
      createTask.mutate({
        bodySerializer: aspNetFormSerializer,
        body: {
          ...commonFields,
          attachments:
            data.newAttachments.length > 0 ? data.newAttachments : undefined,
        },
        path: {
          projectId: Number(project.id),
          columnId: columnId ?? defaultColumnId,
        },
      });
    }
  };

  const removeExistingAttachment = (id: string) => {
    setExistingAttachments((prev) => prev.filter((a) => String(a.id) !== id));
    form.setValue("removedAttachmentIds", [
      ...form.getValues("removedAttachmentIds"),
      id,
    ]);
  };

  const selectedColumn = editingTask
    ? project.columns.find((c) => Number(c.id) === Number(editingTask.columnId))
    : project.columns.find(
        (c) => Number(c.id) === (columnId ?? defaultColumnId),
      );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{editingTask ? "Edit Task" : "New Task"}</SheetTitle>
          {editingTask && selectedColumn && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
              <div
                className="size-2 rounded-full shrink-0"
                style={{ backgroundColor: selectedColumn.color }}
              />
              {selectedColumn.name}
            </div>
          )}
        </SheetHeader>

        <form
          id={FORM_ID}
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex-1 overflow-y-auto"
        >
          <div className="space-y-5 px-6 py-5">
            {/* Column selector — create mode only */}
            {!editingTask && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Column</label>
                <Select
                  value={String(columnId ?? defaultColumnId)}
                  onValueChange={(v) => setColumnId(Number(v))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        {selectedColumn && (
                          <div
                            className="size-2 rounded-full shrink-0"
                            style={{ backgroundColor: selectedColumn.color }}
                          />
                        )}
                        {selectedColumn?.name ?? "Select column"}
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {[...project.columns]
                      .sort((a, b) => Number(a.score) - Number(b.score))
                      .map((col) => (
                        <SelectItem key={col.id} value={String(col.id)}>
                          <div className="flex items-center gap-2">
                            <div
                              className="size-2 rounded-full shrink-0"
                              style={{ backgroundColor: col.color }}
                            />
                            {col.name}
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <InputField
                  field={field}
                  fieldState={fieldState}
                  labelProps={{ children: "Name" }}
                  inputProps={{ placeholder: "Task name" }}
                />
              )}
            />

            <Controller
              control={form.control}
              name="description"
              render={({ field, fieldState }) => (
                <MarkdownField
                  field={field}
                  fieldState={fieldState}
                  labelProps={{ children: "Description" }}
                  inputProps={{
                    placeholder: "What needs to be done? Markdown is supported.",
                    rows: 4,
                    className: "resize-none",
                  }}
                />
              )}
            />

            <Controller
              control={form.control}
              name="priority"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Priority</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map(
                        (p) => (
                          <SelectItem key={p} value={p}>
                            {p.charAt(0) + p.slice(1).toLowerCase()}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <Controller
                control={form.control}
                name="startDate"
                render={({ field, fieldState }) => (
                  <DatePickerField
                    field={field}
                    fieldState={fieldState}
                    labelProps={{ children: "Start date" }}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="dueDate"
                render={({ field, fieldState }) => (
                  <DatePickerField
                    field={field}
                    fieldState={fieldState}
                    labelProps={{ children: "Due date" }}
                  />
                )}
              />
            </div>

            <Controller
              control={form.control}
              name="assigneeIds"
              render={({ field }) => (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Assignees</label>
                  <div className="flex flex-wrap gap-2">
                    {project.participants.map((p) => {
                      const isSelected = (field.value as number[]).includes(
                        Number(p.userId),
                      );
                      return (
                        <button
                          key={String(p.userId)}
                          type="button"
                          onClick={() => {
                            const current = field.value as number[];
                            const id = Number(p.userId);
                            field.onChange(
                              isSelected
                                ? current.filter((x) => x !== id)
                                : [...current, id],
                            );
                          }}
                          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                            isSelected
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                          }`}
                        >
                          <Avatar className="size-4">
                            <AvatarFallback className="text-[8px]">
                              {getInitials(p.name)}
                            </AvatarFallback>
                          </Avatar>
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            />

            <Controller
              control={form.control}
              name="tags"
              render={({ field, fieldState }) => (
                <TextCollectionField
                  field={field}
                  fieldState={fieldState}
                  labelProps={{ children: "Tags" }}
                  inputProps={{ placeholder: "Add tag and press Enter" }}
                />
              )}
            />

            {/* Attachments */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Attachments</label>

              {/* Existing attachments (edit mode) */}
              {existingAttachments.length > 0 && (
                <div className="space-y-2">
                  {existingAttachments.map((a) => (
                    <ExistingAttachmentItem
                      key={String(a.id)}
                      attachment={a}
                      projectId={Number(project.id)}
                      onRemove={() => removeExistingAttachment(String(a.id))}
                    />
                  ))}
                </div>
              )}

              {/* New file dropzone */}
              <Controller
                control={form.control}
                name="newAttachments"
                render={({ field, fieldState }) => (
                  <DropzoneField
                    field={field}
                    fieldState={fieldState}
                    inputProps={{ maxFiles: 5, multiple: true }}
                  />
                )}
              />
            </div>
          </div>
        </form>

        <SheetFooter className="border-t px-6 py-4 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={isPending}>
            {isPending && <Spinner className="size-4" />}
            {editingTask ? "Save changes" : "Create task"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
