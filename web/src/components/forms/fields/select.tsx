import { type ComponentProps, useId } from "react";
import type { FieldPath, FieldValues } from "react-hook-form";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import type { FormFieldProps } from ".";

type Props<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = FormFieldProps<TFieldValues, TName> & {
  selectProps?: ComponentProps<typeof Select>;
  children: React.ReactNode;
};

export function SelectField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  id,
  field,
  fieldState,
  fieldProps = {},
  labelProps = {},
  selectProps = {},
  withErrors = true,
  children,
}: Props<TFieldValues, TName>) {
  id ??= useId();

  return (
    <Field data-invalid={fieldState.invalid} {...fieldProps}>
      <FieldLabel htmlFor={id} {...labelProps} />

      <Select {...selectProps} {...field}>
        {children}
      </Select>

      {fieldState.invalid && withErrors && (
        <FieldError errors={[fieldState.error]} />
      )}
    </Field>
  );
}
