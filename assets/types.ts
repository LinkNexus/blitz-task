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

export interface Team {
  id: number;
  name: string;
  isDefault: boolean;
  projects?: Project[];
}

export interface Project {
  id: number;
  name: string;
  isDefault: boolean;
  columns?: TaskColumn[];
}

export interface Task {
  id: number;
  name: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  assignees: Pick<User, "id" | "name">[];
  dueAt: string | null;
  labels: Label[];
  createdAt: string;
  score: number;
}

export interface Label {
  id: number;
  name: string;
}

export interface TaskColumn {
  id: number;
  name: string;
  color: string;
  score: number;
  tasks: Task[];
}
