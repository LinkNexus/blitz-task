import { Badge } from "@/components/ui/badge";
import { CardContent } from "@/components/ui/card";
import type { Task } from "@/types";
import { Avatar, AvatarImage, AvatarFallback } from "@radix-ui/react-avatar";
import { Calendar, Clock, MessageSquare, Paperclip } from "lucide-react";
import { memo } from "react";

type Props = {
	task: Task;
	isOverdue: boolean;
};

export const TaskCardContent = memo(({ task, isOverdue }: Props) => {
	return (
		<CardContent className="pt-0 px-3 sm:px-6 pb-3 sm:pb-6">
			{/* Labels */}
			<div className="flex flex-wrap gap-1 mb-2 sm:mb-3">
				{task.labels.map((label) => (
					<Badge
						key={label.id}
						variant="secondary"
						className={`text-xs px-1 sm:px-2 py-0`}
					>
						{label.name}
					</Badge>
				))}
			</div>

			{/* Footer */}
			<div className="flex items-center justify-between text-xs text-muted-foreground">
				<div className="flex items-center gap-2 sm:gap-3">
					{task.dueAt !== null && (
						<div className="flex items-center gap-1">
							<Calendar className="w-3 h-3" />
							<span
								className={`text-xs ${
									isOverdue ? "text-red-600 font-medium" : ""
								}`}
							>
								{new Date(task.dueAt).toLocaleDateString("en-US", {
									month: "short",
									day: "numeric",
								})}
							</span>
							{isOverdue && <Clock className="w-3 h-3 text-red-600" />}
						</div>
					)}
					<div className="hidden sm:flex items-center gap-1">
						<MessageSquare className="w-3 h-3" />
						<span>3</span>
					</div>
					<div className="hidden sm:flex items-center gap-1">
						<Paperclip className="w-3 h-3" />
						<span>2</span>
					</div>
				</div>

				{/* Assignees */}
				<div className="flex -space-x-1">
					<div className="*:data-[slot=avatar]:ring-background flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:grayscale">
						{task.assignees.slice(0, 2).map((assignee) => (
							<Avatar
								key={assignee.id}
								className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-background"
							>
								<AvatarImage src="" alt={assignee.name} />
								<AvatarFallback className="text-xs">
									{assignee.name
										.split(" ")
										.map((n) => n[0])
										.join("")}
								</AvatarFallback>
							</Avatar>
						))}
					</div>
					{task.assignees.length > 2 && (
						<div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs">
							+{task.assignees.length - 2}
						</div>
					)}
				</div>
			</div>
		</CardContent>
	);
});
