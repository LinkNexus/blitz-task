import type { ComponentProps } from "react";
import { useId } from "react";
import type { FieldPath, FieldValues } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import type { FormFieldProps } from ".";

type Props<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = FormFieldProps<TFieldValues, TName> & {
  inputProps?: ComponentProps<typeof Checkbox>;
};

export function CheckboxField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  field,
  fieldState,
  labelProps,
  inputProps,
  withErrors = true,
}: Props<TFieldValues, TName>) {
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
      {fieldState.invalid && withErrors && (
        <FieldError errors={[fieldState.error]} />
      )}
    </Field>
  );
}
