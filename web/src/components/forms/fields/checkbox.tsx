import type { ComponentProps } from "react";
import { useId } from "react";
import type {
  ControllerFieldState,
  ControllerRenderProps,
  FieldPath,
  FieldValues,
} from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field.tsx";

type Props<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  field: ControllerRenderProps<TFieldValues, TName>;
  fieldState: ControllerFieldState;
  inputProps?: ComponentProps<typeof Checkbox>;
  labelProps?: ComponentProps<typeof FieldLabel>;
};

export function CheckboxField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({ field, fieldState, labelProps, inputProps }: Props<TFieldValues, TName>) {
  const id = useId();

  return (
    <Field orientation="horizontal" data-invalid={fieldState.invalid}>
      <Checkbox
        name={field.name}
        checked={field.value}
        onCheckedChange={field.onChange}
        id={id}
        aria-invalid={fieldState.invalid}
        {...inputProps}
      />
      <FieldLabel htmlFor={id} {...labelProps} />
      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
    </Field>
  );
}
