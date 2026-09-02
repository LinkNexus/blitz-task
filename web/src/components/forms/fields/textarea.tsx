import { type ComponentProps, useId } from "react";
import type { FieldPath, FieldValues } from "react-hook-form";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { FormFieldProps } from ".";

type Props<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = FormFieldProps<TFieldValues, TName> & {
  inputProps?: ComponentProps<typeof Textarea>;
};

export function TextareaField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  id,
  field,
  fieldState,
  labelProps = {},
  inputProps = {},
  fieldProps = {},
  withErrors = true,
}: Props<TFieldValues, TName>) {
  id ??= useId();
  return (
    <Field data-invalid={fieldState.invalid} {...fieldProps}>
      <FieldLabel htmlFor={id} {...labelProps} />
      <Textarea
        id={id}
        aria-invalid={fieldState.invalid}
        {...field}
        {...inputProps}
      />
      {fieldState.invalid && withErrors && (
        <FieldError errors={[fieldState.error]} />
      )}
    </Field>
  );
}
