import type { PropsWithChildren, ReactNode } from "react";
import {
  EmojiPicker,
  EmojiPickerContent,
  EmojiPickerFooter,
  EmojiPickerSearch,
} from "../ui/emoji-picker";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

export function IconsPopover({
  children,
  onEmojiSelect,
}: PropsWithChildren<{ onEmojiSelect: (emoji: string) => void }>) {
  return (
    <Popover>
      {children && <PopoverTrigger asChild>{children}</PopoverTrigger>}
      <PopoverContent>
        <EmojiPicker
          className="h-[342px]"
          onEmojiSelect={({ emoji }) => onEmojiSelect(emoji)}
        >
          <EmojiPickerSearch />
          <EmojiPickerContent />
          <EmojiPickerFooter />
        </EmojiPicker>
      </PopoverContent>
    </Popover>
  );
}
