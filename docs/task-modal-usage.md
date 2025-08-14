# Task Modal Usage Guide

## Overview

The task modal system provides a comprehensive interface for creating and editing tasks in the kanban board. It uses React Hook Form with Zod validation and FormData for API submissions.

## Features

-   ✅ Create new tasks with column assignment
-   ✅ Edit existing tasks
-   ✅ Form validation with Zod schema
-   ✅ Assignee and label management
-   ✅ Create new labels on-the-fly
-   ✅ Due date picker
-   ✅ Priority selection
-   ✅ File upload support
-   ✅ FormData API submission

## How to Use

### Opening the Modal

#### From Column "Add Task" Button

```tsx
// Each column has an "Add task" button that opens the modal with that column pre-selected
<Button onClick={() => onAddTask?.(column.id)}>Add task</Button>
```

#### From Task Card Edit

```tsx
// Click the edit button on any task card to open the modal with task data pre-filled
<TaskCard onEdit={handleTaskEdit} />
```

#### From Board Header

```tsx
// The main "Add Task" button creates a task in the first column
<BoardHeader onAddTask={handleAddTask} />
```

### Task Modal Hook

```tsx
import { useTaskModal } from "@/hooks/useTaskModal";

const {
    isOpen,
    currentTask,
    defaultColumnId,
    openCreateModal,
    openEditModal,
    closeModal,
} = useTaskModal();

// Create new task in specific column
openCreateModal(columnId);

// Edit existing task
openEditModal(task);

// Close modal
closeModal();
```

### Creating Labels On-The-Fly

The task modal now supports creating new labels without leaving the modal:

1. **Search for Labels**: Type in the label search box to find existing labels
2. **Create New Labels**: If no matching label is found, a "Create [label name]" option appears
3. **Automatic Addition**: Newly created labels are automatically added to the current task
4. **Duplicate Prevention**: If a label with the same name already exists, it will be added instead of creating a duplicate

```tsx
// The modal handles label creation automatically
// Users can type any label name and create it instantly
// Example flow:
// 1. User types "Frontend" in label search
// 2. If "Frontend" doesn't exist, "Create 'Frontend'" option appears
// 3. User clicks it, label is created via API and added to task
// 4. Toast notification confirms creation
```

### Form Validation

The modal uses Zod schema validation:

```typescript
const taskSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    due_date: z.string().optional(),
    column_id: z.number().min(1, "Column is required"),
    assignee_ids: z.array(z.number()).optional(),
    label_ids: z.array(z.number()).optional(),
});
```

### API Integration

The modal submits data using FormData to `/api/tasks`:

```typescript
// For creating new tasks
const formData = new FormData();
formData.append("title", data.title);
formData.append("column_id", data.column_id.toString());
// ... other fields

fetch("/api/tasks", {
    method: "POST",
    body: formData,
});

// For updating existing tasks
fetch(`/api/tasks/${taskId}`, {
    method: "PUT",
    body: formData,
});
```

## Backend Requirements

To complete the integration, implement the `/api/tasks` and `/api/labels` endpoints:

### Task Endpoints

```php
// POST /api/tasks - Create new task
// PUT /api/tasks/{id} - Update existing task

public function createTask(Request $request): JsonResponse
{
    $title = $request->get('title');
    $columnId = (int) $request->get('column_id');
    $description = $request->get('description');
    $priority = $request->get('priority');
    $dueDate = $request->get('due_date');
    $assigneeIds = $request->get('assignee_ids', []);
    $labelIds = $request->get('label_ids', []);

    // Handle file uploads
    $uploadedFile = $request->files->get('attachment');

    // Create task entity and persist
    // Return JSON response with created task data
}
```

### Label Endpoints

````php
// POST /api/labels - Create new label

public function createLabel(Request $request): JsonResponse
{
    $name = trim($request->get('name'));

    if (empty($name)) {
        return new JsonResponse(['error' => 'Label name is required'], 400);
    }

    // Check if label already exists (case-insensitive)
    $existingLabel = $this->labelRepository->findOneBy([
        // Use LOWER() or similar for case-insensitive search
    ]);

    if ($existingLabel) {
        return new JsonResponse(['error' => 'Label already exists'], 409);
    }

    // Create new label entity
    $label = new TaskLabel();
    $label->setName($name);
    // Set other properties like color, project association, etc.

    $this->entityManager->persist($label);
    $this->entityManager->flush();

    return new JsonResponse([
        'id' => $label->getId(),
        'name' => $label->getName(),
        'color' => $label->getColor(),
        // ... other label properties
    ]);
}
```## Current Status

✅ **Completed:**

-   Task modal component with full form validation
-   React Hook Form integration with Zod schema
-   Task creation and editing UI
-   Column assignment and default column support
-   Assignee and label selection (with mock data)
-   Date picker and priority selection
-   File upload interface
-   FormData API submission
-   Integration with kanban board drag & drop

⏳ **Pending:**

-   Backend `/api/tasks` endpoint implementation
-   Real user and label data fetching
-   File upload backend handling
-   Task deletion functionality

The frontend is fully functional and ready for backend integration!
````
