import { type ComponentProps, useId } from "react";
import type {
  ControllerFieldState,
  ControllerRenderProps,
  FieldPath,
  FieldValues,
} from "react-hook-form";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type Props<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  id?: string;
  field: ControllerRenderProps<TFieldValues, TName>;
  fieldState: ControllerFieldState;
  inputProps?: ComponentProps<typeof Input>;
  labelProps?: ComponentProps<typeof FieldLabel>;
};

export function InputField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  id,
  field,
  fieldState,
  labelProps = {},
  inputProps = {},
}: Props<TFieldValues, TName>) {
  id ??= useId();
  return (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor={id} {...labelProps} />
      <Input
        id={id}
        aria-invalid={fieldState.invalid}
        {...field}
        {...inputProps}
      />
      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
    </Field>
  );
}
