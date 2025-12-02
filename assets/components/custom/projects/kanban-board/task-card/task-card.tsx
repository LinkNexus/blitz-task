import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { memo, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { getPriorityColor, getPriorityIcon } from "@/lib/tasks";
import type { Task, TaskColumn } from "@/types";
import { TaskCardMenu } from "./task-card-menu";
import { TaskCardContent } from "./task-card-content";

export type TaskCardProps = {
	task: Task;
	columns: TaskColumn[];
	currentColumn: TaskColumn;
};

export const TaskCard = memo(
	({ task, columns, currentColumn }: TaskCardProps) => {
		const {
			attributes,
			listeners,
			setNodeRef,
			transform,
			transition,
			isDragging,
		} = useSortable({
			id: `task-${task.id}`,
			data: {
				type: "task",
				task,
			},
		});

		const style = {
			transform: CSS.Transform.toString(transform),
			transition,
		};

		const maxColumnsScore = useMemo(
			() => Math.max(...columns.map((column) => column.score)),
			[columns],
		);

		const isTaskOverdue = useMemo(() => {
			return (
				task.dueAt !== null &&
				new Date(task.dueAt) < new Date() &&
				currentColumn.score < maxColumnsScore
			);
		}, [task.dueAt, currentColumn.score, maxColumnsScore]);

		return (
			<Card
				ref={setNodeRef}
				style={style}
				className={`mb-2 sm:mb-3 transition-all bg-card ${
					isDragging ? "opacity-50 shadow-lg z-50" : "hover:shadow-md"
				}`}
			>
				<CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
					<div className="flex items-start justify-between">
						<div className="flex items-center gap-1 sm:gap-2">
							{getPriorityIcon(task.priority)}
							<Badge
								variant="outline"
								className={`text-xs ${getPriorityColor(task.priority)}`}
							>
								<span className="hidden sm:inline">{task.priority}</span>
								<span className="sm:hidden">
									{task.priority.charAt(0).toUpperCase()}
								</span>
							</Badge>
						</div>

						<div className="flex items-center gap-1">
							<TaskCardMenu {...{ task, columns, currentColumn }} />
							<div
								className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted/50 rounded transition-colors"
								onClick={(e) => e.stopPropagation()}
								{...listeners}
								{...attributes}
							>
								<GripVertical className="w-3 h-3 text-muted-foreground" />
							</div>
						</div>
					</div>

					<CardTitle
						className="text-xs sm:text-sm font-medium leading-tight cursor-pointer hover:text-primary transition-colors"
						onClick={() => console.log("Open task", task.id)}
					>
						{task.name}
					</CardTitle>
					<CardDescription className="text-xs text-muted-foreground line-clamp-2">
						{task.description}
					</CardDescription>
				</CardHeader>

				<TaskCardContent task={task} isOverdue={isTaskOverdue} />
			</Card>
		);
	},
);
