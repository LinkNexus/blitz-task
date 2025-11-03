interface User {
	id: number;
	name: string;
	email: string;
	isVerified: boolean;
}

interface FormErrors {
	violations: {
		propertyPath: string;
		title: string;
	}[];
}

interface Project {
	id: number;
	icon: string | null;
	name: string;
	description: string;
	createdBy: Pick<User, "id" | "name">;
	columns: TaskColumn[];
	participants: this["createdBy"][];
	createdAt: string;
	image: string | null;
}

interface TaskColumn {
	id: number;
	name: string;
	color: string;
	score: number;
	tasks: Task[];
}

interface Task {
	name: string;
	description: string;
	priority: "low" | "medium" | "high" | "urgent";
	assignees: Pick<User, "id" | "name">[];
	dueAt: string | null;
	createdAt: string;
	score: number;
}

export type { User, FormErrors, Project, TaskColumn, Task };
