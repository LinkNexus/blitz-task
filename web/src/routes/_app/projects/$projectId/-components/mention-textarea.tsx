import { useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  applyMention,
  findMentionQuery,
  matchMentionNames,
} from "./mention-autocomplete";

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Who can be mentioned — the project's participants, the same set the server matches. */
  names: string[];
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
};

/**
 * A comment box that completes `@mentions`.
 *
 * Anchored under the textarea rather than at the caret. Following the caret means measuring
 * text in a mirrored element, which is a lot of machinery to buy a few pixels of placement on a
 * three-row box — and it breaks quietly whenever the font or padding changes. This is the
 * combobox shape instead: a list under the field, driven by the keyboard.
 *
 * The picker only ever inserts a **full participant name**, so everything it completes is
 * something the server will recognise and notify.
 */
export function MentionTextarea({
  value,
  onChange,
  names,
  placeholder,
  rows = 3,
  autoFocus,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const mention = dismissed ? null : findMentionQuery(value, caret);
  const suggestions = mention ? matchMentionNames(mention.query, names) : [];
  const open = mention !== null && suggestions.length > 0;

  const accept = (name: string) => {
    if (!mention) return;

    const next = applyMention(value, mention, caret, name);
    onChange(next.text);
    ref.current?.focus();

    // After the render that carries the new value, not before it — setting the selection now
    // would be overwritten the moment React puts the text in. An effect keyed on `value` would
    // also work and is worse: the effect would not read what it depends on.
    requestAnimationFrame(() => {
      ref.current?.setSelectionRange(next.caret, next.caret);
      setCaret(next.caret);
    });
  };

  const syncCaret = () => {
    if (ref.current) setCaret(ref.current.selectionStart);
  };

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        value={value}
        rows={rows}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="resize-none text-sm"
        onChange={(e) => {
          setDismissed(false);
          setCaret(e.target.selectionStart);
          // Typing changes which names match, so a highlighted row from the previous query is
          // not the one the user is looking at.
          setActive(0);
          onChange(e.target.value);
        }}
        onKeyUp={syncCaret}
        onClick={syncCaret}
        onBlur={() => setDismissed(true)}
        onKeyDown={(e) => {
          if (!open) return;

          // Only intercepted while the list is showing: Enter has to stay a newline the rest of
          // the time, and Escape has to keep reaching the sheet that wraps this.
          switch (e.key) {
            case "ArrowDown":
              e.preventDefault();
              setActive((i) => (i + 1) % suggestions.length);
              break;
            case "ArrowUp":
              e.preventDefault();
              setActive(
                (i) => (i - 1 + suggestions.length) % suggestions.length,
              );
              break;
            case "Enter":
            case "Tab":
              e.preventDefault();
              accept(suggestions[active]);
              break;
            case "Escape":
              e.preventDefault();
              e.stopPropagation();
              setDismissed(true);
              break;
          }
        }}
      />

      {open && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-popover p-1 shadow-md">
          {suggestions.map((name, index) => (
            <li key={name}>
              <button
                type="button"
                // Mouse down rather than click: a click fires after blur, by which point the
                // picker has been dismissed and the selection is gone.
                onMouseDown={(e) => {
                  e.preventDefault();
                  accept(name);
                }}
                onMouseEnter={() => setActive(index)}
                className={cn(
                  "w-full rounded px-2 py-1.5 text-left text-sm",
                  index === active ? "bg-accent" : "hover:bg-accent/60",
                )}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
