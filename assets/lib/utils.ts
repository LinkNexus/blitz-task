import {type ClassValue, clsx} from "clsx";
import {twMerge} from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toFormData<T extends Record<string, any>>(data: T) {
  const formData = new FormData();

  Object.entries(data).forEach(([k, v]) => {
    if (v instanceof File || v instanceof Blob) {
      formData.append(k, v);
    } else if (v !== null && typeof v === "object") {
      formData.append(k, JSON.stringify(v));
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

export function getLabelColor(label: string) {
  const colors = [
    "#007bff",
    "#28a745",
    "#dc3545",
    "#ffc107",
    "#17a2b8",
    "#6c757d",
    "#343a40",
    "#6f42c1",
    "#fd7e14",
    "#20c997",
    "#e83e8c",
  ];

  return colors[label.charCodeAt(0) % colors.length];
}
