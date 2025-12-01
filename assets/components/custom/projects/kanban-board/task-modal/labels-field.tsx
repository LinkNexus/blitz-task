import {memo, useCallback, useEffect, useState} from "react";
import {FormLabel} from "@/components/ui/form.tsx";
import type {FormErrors, TaskLabel} from "@/types.ts";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover.tsx";
import {Button} from "@/components/ui/button.tsx";
import {Loader2, Plus, Tag, X} from "lucide-react";
import {Command, CommandEmpty, CommandGroup, CommandInput, CommandItem} from "@/components/ui/command.tsx";
import {useApiFetch} from "@/hooks/use-api-fetch.ts";
import {useThrottle} from "@/hooks/use-throttle.ts";
import {ApiError, apiFetch} from "@/lib/api-fetch.ts";
import {getLabelColor} from "@/lib/utils.ts";
import {Badge} from "@/components/ui/badge.tsx";
import {toast} from "sonner";

type Props = {
  onChange: (labelIds: number[]) => void;
  watchedLabelIds: number[];
  labels: TaskLabel[];
}

export const LabelsField = memo(function ({onChange, watchedLabelIds, ...props}: Props) {
  const [labels, setLabels] = useState<TaskLabel[]>([...props.labels]);
  const [labelSearchValue, setLabelSearchValue] = useState("");
  const [searchedLabels, setSearchedLabels] = useState<TaskLabel[]>([]);
  const [open, setOpen] = useState(false);
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);

  const trimmedLabelSearchValue = labelSearchValue.trim();

  const {pending: isSearchingLabels, action: searchLabels} = useApiFetch<TaskLabel[]>({
    url: "/api/labels",
    options: {
      onSuccess(res) {
        setSearchedLabels(res.data);
      }
    }
  })

  const throttledSearchLabels = useThrottle(searchLabels);

  useEffect(() => {
    if (open) {
      throttledSearchLabels({
        searchParams: {
          q: trimmedLabelSearchValue
        }
      })
    }
  }, [trimmedLabelSearchValue, open]);

  const addLabel = useCallback(function (label: TaskLabel) {
    if (!watchedLabelIds.includes(label.id)) {
      setLabels([...labels, label]);
      onChange([...watchedLabelIds, label.id]);
    }
    setLabelSearchValue("");
  }, [watchedLabelIds, labels, onChange])

  const removeLabel = useCallback(function (labelId: number) {
    onChange(watchedLabelIds.filter(i => i !== labelId));
  }, [onChange, watchedLabelIds]);

  const createLabel = useCallback(async function (labelName: string) {
    const trimmedName = labelName.trim();
    if (!trimmedName) return;

    const existingLabel = searchedLabels
      .find(l => l.name.toLowerCase() === trimmedName.toLowerCase());
    if (existingLabel) {
      addLabel(existingLabel);
      return;
    }

    setIsCreatingLabel(true);
    await apiFetch<TaskLabel, { name: string }>("/api/labels", {
      data: {
        name: trimmedName
      }
    })
      .then(l => {
        setSearchedLabels([l.data, ...searchedLabels]);
        addLabel(l.data);
      })
      .catch((err: ApiError<FormErrors>) => {
        err.response.data.violations.forEach(v => {
          toast.error("An error occured when trying to create the label", {
            description: v.title
          })
        })
      })
  }, [searchedLabels, addLabel]);

  return (
    <div className="space-y-3">
      <FormLabel>Labels</FormLabel>

      {watchedLabelIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {watchedLabelIds.map((labelId) => {
            const label = labels.find((l) => l.id === labelId);
            if (!label) return null;

            return (
              <Badge
                key={labelId}
                variant="secondary"
                className="flex items-center gap-1"
              >
                <span>{label.name}</span>
                <div onClick={() => removeLabel(labelId)}>
                  <X
                    className="w-3 h-3 cursor-pointer"
                  />
                </div>
              </Badge>
            );
          })}
        </div>
      )}

      <Popover
        onOpenChange={(open) => {
          setOpen(open);
          if (!open) setLabelSearchValue("")
        }}
      >
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="w-full">
            <Plus className="w-4 h-4 mr-2"/>
            Add Label
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-80">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search or create labels..."
              value={labelSearchValue}
              onValueChange={setLabelSearchValue}
            />

            {/* Show loading state when searching */}
            {isSearchingLabels && (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="w-4 h-4 animate-spin mr-2"/>
                <span className="text-sm text-muted-foreground">
                            {labelSearchValue
                              ? "Searching labels..."
                              : "Loading labels..."}
                          </span>
              </div>
            )}

            {!isSearchingLabels &&
              (labelSearchValue.length === 0 ||
                labelSearchValue.length >= 2) && (
                <>
                  <CommandEmpty>
                    {labelSearchValue.trim() && (
                      <div className="p-2">
                        <CommandItem
                          onSelect={() =>
                            createLabel(labelSearchValue)
                          }
                          className="cursor-pointer"
                          disabled={isCreatingLabel}
                        >
                          {isCreatingLabel ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin"/>
                          ) : (
                            <Tag className="w-4 h-4 mr-2"/>
                          )}
                          <span>Create "{labelSearchValue.trim()}"</span>
                        </CommandItem>
                      </div>
                    )}
                  </CommandEmpty>
                  <CommandGroup>
                    {/* Show "Create new" option even when there are existing labels */}
                    {labelSearchValue.trim() &&
                      !searchedLabels.some(
                        (label) =>
                          label.name.toLowerCase() ===
                          labelSearchValue.toLowerCase().trim()
                      ) && (
                        <CommandItem
                          onSelect={() =>
                            createLabel(labelSearchValue)
                          }
                          className="cursor-pointer border-b"
                          disabled={isCreatingLabel}
                        >
                          {isCreatingLabel ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin"/>
                          ) : (
                            <Tag className="w-4 h-4 mr-2"/>
                          )}
                          <span>Create "{labelSearchValue}"</span>
                        </CommandItem>
                      )}

                    {searchedLabels
                      .filter(
                        (label) => !watchedLabelIds.includes(label.id)
                      )
                      .map((label) => (
                        <CommandItem
                          key={label.id}
                          onSelect={() => addLabel(label)}
                        >
                          <div
                            className="w-3 h-3 rounded-full mr-2"
                            style={{
                              backgroundColor: getLabelColor(label.name)
                            }}
                          />
                          <span>{label.name}</span>
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </>
              )}
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
})
