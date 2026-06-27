import { type ComponentProps, useId } from "react";
import type { FieldPath, FieldValues } from "react-hook-form";
import { toast } from "sonner";
import {
  Dropzone,
  DropzoneContent,
  DropzoneEmptyState,
  DropzoneFileList,
} from "@/components/ui/dropzone";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import type { FormFieldProps } from ".";

type Props<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = FormFieldProps<TFieldValues, TName> & {
  inputProps?: ComponentProps<typeof Dropzone>;
};

export function DropzoneField<
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

  const files: File[] = field.value
    ? Array.isArray(field.value)
      ? (field.value as File[])
      : [field.value as File]
    : [];

  const isMulti = Array.isArray(field.value);

  const handleRemove = (fileToRemove: File) => {
    if (isMulti) {
      field.onChange(
        (field.value as File[]).filter((f) => f !== fileToRemove),
      );
    } else {
      field.onChange(null);
    }
  };

  const handleRename = (fileToRename: File, newName: string) => {
    const renamed = new File([fileToRename], newName, {
      type: fileToRename.type,
      lastModified: fileToRename.lastModified,
    });
    if (isMulti) {
      field.onChange(
        (field.value as File[]).map((f) => (f === fileToRename ? renamed : f)),
      );
    } else {
      field.onChange(renamed);
    }
  };

  return (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor={id} {...labelProps} />
      <Dropzone
        src={files}
        onError={(err) => {
          toast.error(`Error uploading file: ${err.message}`);
        }}
        {...inputProps}
      >
        <DropzoneEmptyState />
        <DropzoneContent />
      </Dropzone>
      {files.length > 0 && (
        <DropzoneFileList
          files={files}
          onRemove={handleRemove}
          onRename={handleRename}
        />
      )}
      {fieldState.invalid && withErrors && (
        <FieldError errors={[fieldState.error]} />
      )}
    </Field>
  );
}
