import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command.tsx";
import { FormField, FormItem, FormLabel } from "@/components/ui/form.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { useApiFetch } from "@/hooks/useFetch.ts";
import type { TaskFormData } from "@/hooks/useTaskForm.ts";
import { useThrottle } from "@/hooks/useThrottle.ts";
import { apiFetch } from "@/lib/fetch.ts";
import type { Label } from "@/types.ts";
import { Loader2, Plus, Tag, X } from "lucide-react";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

interface TaskLabelSectionProps {
  form: UseFormReturn<TaskFormData>;
  labels: Label[];
  setLabels: (labels: Label[]) => void;
}

export function TaskLabelSection({ form, labels, setLabels }: TaskLabelSectionProps) {
  const [searchedLabels, setSearchedLabels] = useState<Label[]>([]);
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);
  const [labelSearchValue, setLabelSearchValue] = useState("");
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);

  const watchedLabelIds = form.watch("labelIds") || [];

  const { callback: searchLabels, pending: isSearchingLabels } = useApiFetch("/api/labels", {
    onSuccess: setSearchedLabels,
    onError(error) {
      console.error("Failed to fetch labels:", error);
    },
  });

  const throttledSearchLabels = useThrottle(searchLabels, 300);

  function addLabel(label: Label) {
    if (!watchedLabelIds.includes(label.id)) {
      form.setValue("labelIds", [...watchedLabelIds, label.id]);
      setLabels([...labels, label]);
    }
    setIsLabelModalOpen(false);
    setLabelSearchValue("");
  }

  function removeLabel(labelId: number) {
    form.setValue(
      "labelIds",
      watchedLabelIds.filter((id) => id !== labelId)
    );
  }

  function createLabel(labelName: string) {
    const trimmedName = labelName.trim();
    if (!trimmedName) return;

    const existingLabel = searchedLabels.find(l => l.name.toLowerCase() === trimmedName.toLowerCase());
    if (existingLabel) {
      addLabel(existingLabel);
      return;
    }

    setIsCreatingLabel(true);
    apiFetch<Label>("/api/labels", {
      method: "POST",
      data: { name: trimmedName },
    })
      .then((newLabel) => {
        addLabel(newLabel);
        toast.success(`Label "${newLabel.name}" created successfully`);
      })
      .catch((err) => {
        console.error("Failed to create label:", err);
        err.data.violations?.forEach((v: { title: string }) => {
          toast.error(v.title);
        })
      })
      .finally(() => setIsCreatingLabel(false));
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
                    <Tag className="w-3 h-3" />
                    <span className="text-xs">{label.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-3 w-3 p-0 hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => removeLabel(labelId)}
                    >
                      <X className="w-2 h-2" />
                    </Button>
                  </Badge>
                );
              })}
            </div>

            {/* Add Label Popover */}
            <Popover open={isLabelModalOpen} onOpenChange={setIsLabelModalOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Label
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search or create labels..."
                    value={labelSearchValue}
                    onValueChange={(value) => {
                      setLabelSearchValue(value);
                      if (value.trim()) {
                        throttledSearchLabels({
                          searchParams: { query: value.trim() },
                        });
                      }
                    }}
                  />
                  {isSearchingLabels ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  ) : (
                    <>
                      <CommandEmpty>
                        {labelSearchValue.trim() ? (
                          <div className="text-center py-2">
                            <p className="text-sm text-muted-foreground mb-2">
                              No labels found.
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => createLabel(labelSearchValue)}
                              disabled={isCreatingLabel}
                              className="w-full"
                            >
                              {isCreatingLabel ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <Plus className="w-3 h-3 mr-1" />
                              )}
                              Create "{labelSearchValue.trim()}"
                            </Button>
                          </div>
                        ) : (
                          "Type to search or create labels..."
                        )}
                      </CommandEmpty>
                      <CommandGroup>
                        {searchedLabels
                          .filter((label) => !watchedLabelIds.includes(label.id))
                          .map((label) => (
                            <CommandItem
                              key={label.id}
                              onSelect={() => addLabel(label)}
                              className="cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                <Tag className="w-3 h-3" />
                                <span>{label.name}</span>
                              </div>
                            </CommandItem>
                          ))}
                        {labelSearchValue.trim() &&
                          !searchedLabels.some(
                            (label) =>
                              label.name.toLowerCase() === labelSearchValue.toLowerCase()
                          ) && (
                            <CommandItem
                              onSelect={() => createLabel(labelSearchValue)}
                              className="cursor-pointer border-t"
                            >
                              <div className="flex items-center gap-2">
                                <Plus className="w-3 h-3" />
                                <span>Create "{labelSearchValue.trim()}"</span>
                              </div>
                            </CommandItem>
                          )}
                      </CommandGroup>
                    </>
                  )}
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </FormItem>
      )}
    />
  );
}
