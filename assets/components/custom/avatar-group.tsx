import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

type Props = ComponentProps<"div"> & { grayscale?: boolean };

export function AvatarGroup({ children, grayscale, ...props }: Props) {
	return (
		<div
			className={cn(
				"*:data-[slot=avatar]:ring-background flex -space-x-2 *:data-[slot=avatar]:ring-2",
				grayscale && "*:data-[slot=avatar]:grayscale",
			)}
		>
			{children}
		</div>
	);
}
