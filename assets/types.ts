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
  members: Pick<User, "id" | "name">[];
}

export interface Project {
  id: number;
  name: string;
  isDefault: boolean;
  columns?: TaskColumn[];
}

export interface Attachment {
  id: number;
  name: string;
  link: string;
  filename: string;
}

export interface Comment {
  id: number;
  content: string;
  author: Pick<User, "id" | "name">;
  createdAt: string;
  updatedAt: string;
  attachments: Attachment[];
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
  comments?: Comment[];
  attachments: Attachment[];
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
