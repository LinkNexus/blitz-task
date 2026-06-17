import { IconPlus, IconX } from "@tabler/icons-react";
import { type ComponentProps, type ReactNode, useId, useRef } from "react";
import type {
  ControllerFieldState,
  ControllerRenderProps,
  FieldPath,
  FieldValues,
} from "react-hook-form";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Field, FieldError, FieldLabel } from "../../ui/field";
import { Input } from "../../ui/input";

type SelectedItemsComponentType = (
  items: string[],
  removeItem: (item: string) => void,
) => ReactNode;

type Props<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  field: ControllerRenderProps<TFieldValues, TName>;
  fieldState: ControllerFieldState;
  inputProps?: ComponentProps<typeof Input>;
  labelProps?: ComponentProps<typeof FieldLabel>;
  selectedItemsComponent?: SelectedItemsComponentType;
};

const defaultItemsComponent: SelectedItemsComponentType = (
  items,
  removeItem,
) => (
  <div className="flex flex-wrap gap-2">
    {items.map((item) => (
      <Badge key={item} variant="secondary" className="flex items-center gap-1">
        <span>{item}</span>
        <div onClick={() => removeItem(item)}>
          <IconX className="h-3 w-3 cursor-pointer" />
        </div>
      </Badge>
    ))}
  </div>
);

export function TextCollectionField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  field,
  fieldState,
  labelProps = {},
  inputProps = {},
  selectedItemsComponent,
}: Props<TFieldValues, TName>) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const addItem = (item: string) => {
    item = item.trim().toLowerCase();
    const parts = item
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter((part) => !!part && !(field.value as string[]).includes(part));

    field.onChange([...(field.value as string[]), ...parts]);
  };

  const removeItem = (item: string) => {
    field.onChange((field.value as string[]).filter((i) => i !== item));
  };

  return (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor={id} {...labelProps} />

      {(selectedItemsComponent || defaultItemsComponent)(
        (field.value as string[]) || [],
        removeItem,
      )}

      <div className="flex flex-col gap-2 md:flex-row">
        <Input
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (!e.shiftKey) {
                addItem(e.currentTarget.value);
                e.currentTarget.value = "";
              }
              e.preventDefault();
            }
          }}
          id={id}
          aria-invalid={fieldState.invalid}
          {...inputProps}
          ref={inputRef}
        />
        <Button
          type="button"
          onClick={() => {
            if (inputRef.current) {
              addItem(inputRef.current.value);
              inputRef.current.value = "";
              inputRef.current.focus();
            }
          }}
        >
          <IconPlus size={4} />
        </Button>
      </div>

      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
    </Field>
  );
}
