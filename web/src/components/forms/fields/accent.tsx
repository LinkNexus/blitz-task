import { IconCheck } from "@tabler/icons-react";
import { useId } from "react";
import type { FieldPath, FieldValues } from "react-hook-form";
import type { ProjectAccent } from "@/api";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { ACCENT_OPTIONS, accentFill } from "@/lib/project-accent";
import { cn } from "@/lib/utils";
import type { FormFieldProps } from ".";

type Props<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = FormFieldProps<TFieldValues, TName> & {
  disabled?: boolean;
};

/**
 * A project's accent, as nine swatches.
 *
 * A radio group rather than the `<input type="color">` that columns and sections use, and the
 * difference is the point: those are painted as a 2px rule or a 10px dot where no contrast
 * requirement applies, while an accent is a fixed set whose light and dark values are both
 * checked (`theme-contrast.test.ts`). A colour wheel cannot offer that, and it also lets someone
 * pick two projects a hair apart, which defeats the only thing an accent is for.
 *
 * Built from real `<input type="radio">`s with the input itself visually hidden rather than from
 * buttons: arrow-key traversal, a single tab stop for the whole group, and the name/checked
 * semantics a screen reader needs all come free, and none of them survives being rebuilt.
 */
export function AccentField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  field,
  fieldState,
  labelProps = {},
  disabled = false,
  withErrors = true,
}: Props<TFieldValues, TName>) {
  const name = useId();
  const selected = (field.value as ProjectAccent) ?? "None";

  return (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel {...labelProps} />

      <div role="radiogroup" className="flex flex-wrap gap-2">
        {ACCENT_OPTIONS.map((option) => {
          const isSelected = option.value === selected;

          return (
            <label
              key={option.value}
              // `ring` for the selected state and not a border: a border would change the
              // swatch's box and shift every swatch after it as the selection moves.
              className={cn(
                "relative flex size-7 cursor-pointer items-center justify-center rounded-full transition-shadow",
                accentFill(option.value),
                isSelected &&
                  "ring-2 ring-ring ring-offset-2 ring-offset-background",
                disabled && "cursor-not-allowed opacity-50",
                "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
              )}
              title={option.label}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={isSelected}
                disabled={disabled}
                onChange={() => field.onChange(option.value)}
                onBlur={field.onBlur}
                className="sr-only"
              />
              {/* The tick is the only thing ever drawn *on* an accent, and it is a glyph rather
                  than text — a 3:1 mark on a 3:1 mark. `--background` rather than white so it
                  stays legible on the dark-mode accents, which are the lighter pair. `None` is
                  the exception both times: its swatch is `--border`, which sits 1.24:1 from
                  `--background`, so the tick has to come from the other end. */}
              {isSelected && (
                <IconCheck
                  className={cn(
                    "size-4 stroke-3",
                    option.value === "None"
                      ? "text-foreground"
                      : "text-background",
                  )}
                />
              )}
              <span className="sr-only">{option.label}</span>
            </label>
          );
        })}
      </div>

      {fieldState.invalid && withErrors && (
        <FieldError errors={[fieldState.error]} />
      )}
    </Field>
  );
}
