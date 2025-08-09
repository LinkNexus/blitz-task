import type { Task, TaskColumn, TaskLabel, User } from "@/types";

export const mockUsers: User[] = [
  {
    id: 1,
    name: "Alice Johnson",
    email: "alice@example.com",
    isVerified: true,
  },
  { id: 2, name: "Bob Smith", email: "bob@example.com", isVerified: true },
  { id: 3, name: "Carol Davis", email: "carol@example.com", isVerified: true },
  { id: 4, name: "David Wilson", email: "david@example.com", isVerified: true },
];

export const mockLabels: TaskLabel[] = [
  { id: 1, name: "Frontend" },
  { id: 2, name: "Backend" },
  { id: 3, name: "Bug" },
  { id: 4, name: "Feature" },
  { id: 5, name: "Design" },
  { id: 6, name: "Testing" },
];

export const mockColumns: TaskColumn[] = [
  { id: 1, name: "To Do", color: "#6b7280", score: 0, tasks: [] },
  { id: 2, name: "In Progress", color: "#3b82f6", score: 1, tasks: [] },
  { id: 3, name: "Review", color: "#f59e0b", score: 2, tasks: [] },
  { id: 4, name: "Done", color: "#10b981", score: 3, tasks: [] },
];

export const mockTasks: Task[] = [
  {
    id: 1,
    name: "Implement user authentication",
    description: "Create login and registration flow with proper validation",
    priority: "high",
    assignees: [mockUsers[0], mockUsers[1]],
    dueAt: "2024-02-01",
    labels: [mockLabels[0]],
    createdAt: "2024-01-15",
    position: 0,
  },
  {
    id: 2,
    name: "Fix responsive design issues",
    description: "Mobile layout is broken on several pages",
    priority: "medium",
    assignees: [mockUsers[2]],
    dueAt: "2025-08-08",
    labels: [mockLabels[0], mockLabels[2]],
    createdAt: "2025-08-02",
    position: 0,
  },
  {
    id: 3,
    name: "Update API documentation",
    description: "Add new endpoints to the API documentation",
    priority: "low",
    assignees: [mockUsers[3]],
    dueAt: null,
    labels: [mockLabels[1], mockLabels[2]],
    createdAt: "2024-01-16",
    position: 0,
  },
  {
    id: 4,
    name: "Design new dashboard layout",
    description: "Create wireframes and mockups for the new dashboard",
    priority: "urgent",
    assignees: [mockUsers[0]],
    dueAt: "2025-08-07",
    labels: [mockLabels[4], mockLabels[3]],
    createdAt: "2025-08-04",
    position: 0,
  },
  {
    id: 5,
    name: "Setup CI/CD pipeline",
    description: "Configure automated testing and deployment",
    priority: "high",
    assignees: [mockUsers[1], mockUsers[3]],
    dueAt: "2025-08-12",
    labels: [mockLabels[1]],
    createdAt: "2025-08-05",
    position: 0,
  },
  {
    id: 6,
    name: "Write unit tests",
    description: "Add comprehensive test coverage for core components",
    priority: "medium",
    assignees: [mockUsers[2]],
    dueAt: null,
    labels: [mockLabels[5]],
    createdAt: "2025-08-01",
    position: 1,
  },
];
