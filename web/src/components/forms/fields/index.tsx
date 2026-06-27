import type { ComponentProps } from "react";
import type {
  ControllerFieldState,
  ControllerRenderProps,
  FieldPath,
  FieldValues,
} from "react-hook-form";
import type { Field, FieldLabel } from "@/components/ui/field";

export type FormFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  id?: string;
  withErrors?: boolean;
  field: ControllerRenderProps<TFieldValues, TName>;
  fieldState: ControllerFieldState;
  labelProps?: ComponentProps<typeof FieldLabel>;
  fieldProps?: ComponentProps<typeof Field>;
};
