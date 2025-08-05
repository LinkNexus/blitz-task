export interface User {
  id: number;
  name: string;
  email: string;
  isVerified: boolean;
}

export interface FormErrors {
  violations: {
    propertyPath: string,
    title: string
  }[]
}

export interface Task {
  id: number;
  name: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  assignees: User[];
  dueAt: string;
  labels: TaskLabel[];
  createdAt: string;
  relatedColumn: TaskColumn;
}

export interface TaskLabel {
  id: number;
  name: string;
}

export interface TaskColumn {
  id: number;
  name: string;
  color: string;
}
