import { type ChangeEventHandler, type ComponentProps, useId } from "react";
import type { FieldPath, FieldValues } from "react-hook-form";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import type { InputGroupInput } from "@/components/ui/input-group";
import { DatePicker } from "../date-picker";
import type { FormFieldProps } from ".";

type Props<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = FormFieldProps<TFieldValues, TName> & {
  inputProps?: ComponentProps<typeof InputGroupInput>;
};

export function DatePickerField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  field,
  fieldState,
  labelProps = {},
  inputProps = {},
  withErrors = true,
}: Props<TFieldValues, TName>) {
  const id = useId();

  const { onChange: fieldOnChange, value, name, onBlur, ref, disabled } = field;
  const { onChange: inputOnChange, ...restInputProps } = inputProps;

  const handleChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    fieldOnChange(e);
    inputOnChange?.(e);
  };

  const handleValidDate = (date: string) => {
    fieldOnChange(date);
  };

  return (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor={id} {...labelProps} />
      <DatePicker
        id={id}
        aria-invalid={fieldState.invalid}
        name={name}
        value={typeof value === "string" ? value : value?.toString()}
        onBlur={onBlur}
        ref={ref}
        disabled={disabled}
        {...restInputProps}
        onChange={handleChange}
        onValidDate={handleValidDate}
      />
      {fieldState.invalid && withErrors && (
        <FieldError errors={[fieldState.error]} />
      )}
    </Field>
  );
}
