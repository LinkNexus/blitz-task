import { toast } from "sonner";
import { useSearchParams } from "wouter";

type FlashMessages = {
	success?: string[];
	error?: string[];
	warning?: string[];
	info?: string[];
};

export function useFlashMessages() {
	const [params] = useSearchParams();
	const messages = params.get("messages");

	if (messages) {
		Object.entries(JSON.parse(messages) as FlashMessages).forEach(([k, v]) => {
			v.forEach((v) => {
				// @ts-ignore
				toast[k](v);
			});
		});
	}
}
