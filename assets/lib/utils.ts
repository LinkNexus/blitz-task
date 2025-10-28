import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function toFormData<
	T extends Record<string, number | string | File | Blob | null>,
>(data: T) {
	const formData = new FormData();

	Object.entries(data).forEach(([k, v]) => {
		if (v instanceof File || v instanceof Blob) {
			formData.append(k, v);
		} else {
			formData.append(k, String(v));
		}
	});

	return formData;
}

export function getInitials(name: string, length = 2): string {
	return name
		.replace(/[^a-zA-Z\s]/g, "") // Remove non-alphabetic characters
		.split(" ")
		.map((part) => part.charAt(0).toUpperCase())
		.slice(0, length)
		.join("");
}
