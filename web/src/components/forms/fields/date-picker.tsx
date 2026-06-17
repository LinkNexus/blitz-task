import { type ChangeEventHandler, type ComponentProps, useId } from "react";
import type {
  ControllerFieldState,
  ControllerRenderProps,
  FieldPath,
  FieldValues,
} from "react-hook-form";
import { Field, FieldError, FieldLabel } from "@/components/ui/field.tsx";
import type { InputGroupInput } from "@/components/ui/input-group";
import { DatePicker } from "../date-picker";

type Props<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  field: ControllerRenderProps<TFieldValues, TName>;
  fieldState: ControllerFieldState;
  inputProps?: ComponentProps<typeof InputGroupInput>;
  labelProps?: ComponentProps<typeof FieldLabel>;
};

export function DatePickerField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  field,
  fieldState,
  labelProps = {},
  inputProps = {},
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
      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
    </Field>
  );
}
