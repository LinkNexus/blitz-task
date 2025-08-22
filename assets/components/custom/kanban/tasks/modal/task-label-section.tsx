import {Badge} from "@/components/ui/badge.tsx";
import {Button} from "@/components/ui/button.tsx";
import {FormField, FormItem, FormLabel} from "@/components/ui/form.tsx";
import type {TaskFormData} from "@/hooks/useTaskForm.ts";
import type {Label} from "@/types.ts";
import {Plus, Tag, X} from "lucide-react";
import {useState} from "react";
import type {UseFormReturn} from "react-hook-form";
import {LabelsPopup} from "@/components/custom/kanban/tasks/labels-popup.tsx";

interface TaskLabelSectionProps {
  form: UseFormReturn<TaskFormData>;
  labels: Label[];
  setLabels: (labels: Label[]) => void;
}

export function TaskLabelSection({form, labels, setLabels}: TaskLabelSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const watchedLabelIds = form.watch("labelIds") || [];

  function addLabel(label: Label) {
    if (!watchedLabelIds.includes(label.id)) {
      form.setValue("labelIds", [...watchedLabelIds, label.id]);
      setLabels([...labels, label]);
    }
  }

  function removeLabel(labelId: number) {
    form.setValue(
      "labelIds",
      watchedLabelIds.filter((id) => id !== labelId)
    );
  }

  return (
    <FormField
      control={form.control}
      name="labelIds"
      render={() => (
        <FormItem>
          <FormLabel>Labels</FormLabel>
          <div className="space-y-3">
            {/* Current Labels */}
            <div className="flex flex-wrap gap-2">
              {watchedLabelIds.map((labelId) => {
                const label = labels.find((l) => l.id === labelId);
                if (!label) return null;

                return (
                  <Badge
                    key={labelId}
                    variant="outline"
                    className="flex items-center gap-2 py-1 px-2"
                  >
                    <Tag className="w-3 h-3"/>
                    <span className="text-xs">{label.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-3 w-3 p-0 hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => removeLabel(labelId)}
                    >
                      <X className="w-2 h-2"/>
                    </Button>
                  </Badge>
                );
              })}
            </div>

            {/* Add Label Popover */}
            <LabelsPopup
              open={isModalOpen}
              onOpenChange={setIsModalOpen}
              onLabelAdd={addLabel}
              excludedIds={watchedLabelIds}
              onClose={() => setIsModalOpen(false)}
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
              >
                <Plus className="w-3 h-3 mr-1"/>
                Add Label
              </Button>
            </LabelsPopup>
          </div>
        </FormItem>
      )}
    />
  );
}
