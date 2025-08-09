# Task Modal Default Column Fix

## Problem

When clicking the "Add task" button on a specific column, the task modal wasn't defaulting to that column. Instead, it was always showing the first column as selected.

## Root Cause

The React Hook Form's `defaultValues` were only set once during form initialization. When the `defaultColumnId` prop changed (when clicking different column's "Add task" buttons), the form didn't update to reflect the new default column.

## Solution

Added two `useEffect` hooks to properly handle default column selection:

### 1. Dynamic Column Update

```typescript
useEffect(() => {
    if (!isEditing && defaultColumnId) {
        setValue("columnId", defaultColumnId);
    }
}, [defaultColumnId, isEditing, setValue]);
```

### 2. Form Reset on Modal Open

```typescript
useEffect(() => {
    if (isOpen) {
        const newColumnId = task
            ? // For editing: find task's current column
              columns.find((col) => col.tasks?.some((t) => t.id === task.id))
                  ?.id || columns[0]?.id
            : // For new tasks: use defaultColumnId
              defaultColumnId || columns[0]?.id;

        reset({
            name: task?.name || "",
            description: task?.description || "",
            priority: task?.priority || "medium",
            columnId: newColumnId,
            assigneeIds: task?.assignees?.map((a) => a.id) || [],
            labelIds: task?.labels?.map((l) => l.id) || [],
            dueAt: task?.dueAt ? new Date(task.dueAt) : undefined,
        });
    }
}, [isOpen, task, defaultColumnId, columns, reset]);
```

## Flow Verification

### New Task Creation

1. User clicks "Add task" button on specific column (e.g., "In Progress")
2. `KanbanColumn` calls `onAddTask(column.id)`
3. `IssuesBoardPage.handleAddTaskToColumn(columnId)` is called
4. `useTaskModal.openCreateModal(columnId)` sets `defaultColumnId`
5. Task modal opens with correct column pre-selected

### Task Editing

1. User clicks edit on existing task
2. `useTaskModal.openEditModal(task)` is called
3. Modal finds task's current column and pre-selects it
4. Form shows task's current column as selected

## Benefits

-   ✅ Clicking "Add task" on any column now correctly pre-selects that column
-   ✅ Editing tasks shows their current column
-   ✅ Switching between different columns' "Add task" buttons works correctly
-   ✅ Form resets properly when modal opens/closes

## User Experience

-   Much more intuitive - tasks are created in the column the user clicked
-   No need to manually change the column dropdown
-   Consistent with user expectations
-   Reduces clicks required to create tasks in specific columns
