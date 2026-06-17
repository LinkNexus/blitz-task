import { type ComponentProps, useId } from "react";
import type {
  ControllerFieldState,
  ControllerRenderProps,
  FieldPath,
  FieldValues,
} from "react-hook-form";
import { toast } from "sonner";
import {
  Dropzone,
  DropzoneContent,
  DropzoneEmptyState,
} from "@/components/ui/dropzone";
import { Field, FieldError, FieldLabel } from "@/components/ui/field.tsx";

type Props<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  field: ControllerRenderProps<TFieldValues, TName>;
  fieldState: ControllerFieldState;
  inputProps?: ComponentProps<typeof Dropzone>;
  labelProps?: ComponentProps<typeof FieldLabel>;
};

export function DropzoneField<
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
      <Dropzone
        src={
          field.value
            ? Array.isArray(field.value)
              ? field.value
              : [field.value]
            : []
        }
        onError={(err) => {
          toast.error(`Error uploading file: ${err.message}`);
        }}
        {...inputProps}
      >
        <DropzoneEmptyState />
        <DropzoneContent />
      </Dropzone>
      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
    </Field>
  );
}
