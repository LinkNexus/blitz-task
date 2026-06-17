import { createStore } from "@tanstack/react-store";
import type { ExternalToast } from "sonner";

export type FlashMessage = {
  id: number;
  type: "success" | "info" | "warning" | "error";
  message: ExternalToast & {
    title: string;
  };
};

export const flashMessagesStore = createStore(
  [] as FlashMessage[],
  ({ setState }) => ({
    add: (messages: Omit<FlashMessage, "id">[]) =>
      setState((prev) => [
        ...prev,
        ...messages.map((m) => ({
          id: prev.length,
          ...m,
        })),
      ]),
    addSingle: (message: Omit<FlashMessage, "id">) =>
      setState((prev) => [...prev, { id: prev.length, ...message }]),
    clear: () => setState(() => []),
  }),
);
