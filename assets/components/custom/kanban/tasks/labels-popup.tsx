import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import {type ReactNode, useEffect, useState} from "react";
import {Button} from "@/components/ui/button.tsx";
import {Loader2, Plus, Tag} from "lucide-react";
import {Command, CommandEmpty, CommandGroup, CommandInput, CommandItem} from "@/components/ui/command.tsx";
import {useApiFetch} from "@/hooks/useApiFetch.ts";
import type {FormErrors, Label} from "@/types.ts";
import {toast} from "sonner";
import {useThrottle} from "@/hooks/useThrottle.ts";

interface LabelsPopupProps {
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  onLabelAdd: (label: Label) => void;
  excludedIds: number[];
}

export function LabelsPopup({children, open, onOpenChange, onLabelAdd, excludedIds, onClose}: LabelsPopupProps) {
  const [searchValue, setSearchValue] = useState("");
  const trimmedSearchValue = searchValue.trim();
  const [searchedLabels, setSearchedLabels] = useState<Label[]>([]);

  const {
    callback: searchLabels,
    pending: isSearchingLabels,
  } = useApiFetch("/api/labels", {
    searchParams: {
      query: trimmedSearchValue
    },
    onSuccess: setSearchedLabels,
    onError(error) {
      console.error("Failed to fetch labels:", error);
    },
  }, [trimmedSearchValue]);

  const throttledSearchLabels = useThrottle(searchLabels, 300);

  const {pending: isCreating, callback: createLabel} = useApiFetch<Label, FormErrors>("/api/labels", {
    data: {
      name: trimmedSearchValue
    },
    onSuccess(data) {
      onLabelAdd(data);
      onClose?.();
      toast.success(`Label "${data.name}" created successfully`);
      setSearchValue("");
    },
    onError(err) {
      err.data.violations?.forEach(value => {
        toast.error(value.title);
      })
    }
  }, [trimmedSearchValue]);

  async function handleCreateLabel() {
    if (trimmedSearchValue) {
      await createLabel();
    }
  }

  useEffect(() => {
    if (trimmedSearchValue) {
      throttledSearchLabels();
    }
  }, [trimmedSearchValue]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {children && (
        <PopoverTrigger asChild>
          {children}
        </PopoverTrigger>
      )}
      <PopoverContent className="w-64 p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search or create labels..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          {isSearchingLabels ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-4 h-4 animate-spin"/>
            </div>
          ) : (
            <>
              <CommandEmpty>
                {trimmedSearchValue ? (
                  <div className="text-center py-2">
                    <p className="text-sm text-muted-foreground mb-2">
                      No labels found.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCreateLabel}
                      disabled={isCreating}
                      className="w-full"
                    >
                      {isCreating ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin"/>
                      ) : (
                        <Plus className="w-3 h-3 mr-1"/>
                      )}
                      Create "{trimmedSearchValue}"
                    </Button>
                  </div>
                ) : (
                  "Type to search or create labels..."
                )}
              </CommandEmpty>
              <CommandGroup>
                {searchedLabels
                  .filter((label) => !excludedIds.includes(label.id))
                  .map((label) => (
                    <CommandItem
                      key={label.id}
                      onSelect={() => {
                        onLabelAdd(label);
                        onClose?.();
                      }}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Tag className="w-3 h-3"/>
                        <span>{label.name}</span>
                      </div>
                    </CommandItem>
                  ))}
                {trimmedSearchValue &&
                  !searchedLabels.some(
                    (label) =>
                      label.name.toLowerCase() === searchValue.toLowerCase()
                  ) && (
                    <CommandItem
                      onSelect={handleCreateLabel}
                      className="cursor-pointer border-t"
                    >
                      <div className="flex items-center gap-2">
                        <Plus className="w-3 h-3"/>
                        <span>Create "{trimmedSearchValue}"</span>
                      </div>
                    </CommandItem>
                  )}
              </CommandGroup>
            </>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  )
}
