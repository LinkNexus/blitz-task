import { type ComponentProps, useId } from "react";
import type { FieldPath, FieldValues } from "react-hook-form";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { FormFieldProps } from ".";

type Props<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = FormFieldProps<TFieldValues, TName> & {
  inputProps?: ComponentProps<typeof Textarea>;
};

export function MarkdownField<
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
  const value = (field.value as string) ?? "";

  return (
    <Field data-invalid={fieldState.invalid} {...fieldProps}>
      {labelProps.children && <FieldLabel htmlFor={id} {...labelProps} />}
      <Tabs defaultValue="write" className="gap-0">
        <TabsList variant="line" className="border-b rounded-none px-0 w-full justify-start h-8 mb-0">
          <TabsTrigger value="write" className="text-xs px-3">
            Write
          </TabsTrigger>
          <TabsTrigger value="preview" className="text-xs px-3">
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="write">
          <Textarea
            id={id}
            aria-invalid={fieldState.invalid}
            {...field}
            {...inputProps}
            className={`rounded-t-none border-t-0 focus-visible:ring-0 focus-visible:border-input ${inputProps.className ?? ""}`}
          />
        </TabsContent>

        <TabsContent value="preview">
          <div
            className={`min-h-[5rem] rounded-b-md border border-t-0 px-3 py-2 ${
              !value.trim()
                ? "flex items-center text-sm text-muted-foreground"
                : ""
            }`}
          >
            {value.trim() ? (
              <div className="markdown-preview prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                >
                  {value}
                </ReactMarkdown>
              </div>
            ) : (
              "Nothing to preview"
            )}
          </div>
        </TabsContent>
      </Tabs>
      {fieldState.invalid && withErrors && (
        <FieldError errors={[fieldState.error]} />
      )}
    </Field>
  );
}
