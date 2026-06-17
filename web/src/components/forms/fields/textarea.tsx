import { type ComponentProps, useId } from "react";
import type {
  ControllerFieldState,
  ControllerRenderProps,
  FieldPath,
  FieldValues,
} from "react-hook-form";
import { Field, FieldError, FieldLabel } from "../../ui/field";
import { Textarea } from "../../ui/textarea";

type Props<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  field: ControllerRenderProps<TFieldValues, TName>;
  fieldState: ControllerFieldState;
  inputProps?: ComponentProps<typeof Textarea>;
  labelProps?: ComponentProps<typeof FieldLabel>;
};

export function TextareaField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  field,
  fieldState,
  labelProps = {},
  inputProps = {},
}: Props<TFieldValues, TName>) {
  const id = useId();
  return (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor={id} {...labelProps} />
      <Textarea
        id={id}
        aria-invalid={fieldState.invalid}
        {...field}
        {...inputProps}
      />
      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
    </Field>
  );
}
