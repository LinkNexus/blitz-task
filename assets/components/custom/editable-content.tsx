import {
  cloneElement,
  type FormEventHandler,
  isValidElement,
  memo,
  type PropsWithChildren,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type Props = PropsWithChildren<{
  value: string;
  onSave: (newValue: string) => void;
}>;

export const EditableContent = memo(({value, onSave, children}: Props) => {
  if (!isValidElement(children)) {
    throw new Error(
      "EditableContent only supports a single React element as a child.",
    );
  }

  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.innerText = draft;
    }
  }, [draft]);

  const handleInput: FormEventHandler<HTMLElement> = useCallback(
    (e) => {
      setDraft((e.target as HTMLElement).innerText);
      children.props.onInput?.(e);
    },
    [children.props.onInput],
  );

  const handleBlur: FormEventHandler<HTMLElement> = useCallback(
    (e) => {
      if (draft !== value) onSave(draft);
      children.props.onBlur?.(e);
    },
    [draft, value, onSave, children.props.onBlur],
  );

  return cloneElement(children, {
    // @ts-ignore
    contentEditable: "true",
    ref: ref,
    suppressContentEditableWarning: true,
    onInput: handleInput,
    onBlur: handleBlur,
  });
});
