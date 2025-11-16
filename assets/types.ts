export interface User {
	id: number;
	name: string;
	email: string;
	isVerified: boolean;
}

export interface FormErrors {
	violations: {
		propertyPath: string;
		title: string;
	}[];
}

export interface Project {
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

export interface TaskColumn {
	id: number;
	name: string;
	color: string;
	score: number;
	tasks: Task[];
}

export interface Task {
	id: number;
	name: string;
	description: string;
	priority: "low" | "medium" | "high" | "urgent";
	assignees: Pick<User, "id" | "name">[];
	dueAt: string | null;
	createdAt: string;
	score: number;
	labels: TaskLabel[];
}

export interface TaskLabel {
	id: number;
	name: string;
}

export interface ProjectInvitation {
	id: number;
	guestEmail: string;
	createdAt: string;
}
