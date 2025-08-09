# Task Position Property Update

## Summary

Updated the Task interface and all related components to use `position` instead of `score` for determining task order within columns.

## Frontend Changes Made

### 1. Types Update

-   **File**: `assets/types.ts`
-   **Change**: Updated Task interface to use `position: number` instead of `score: number`

### 2. Store Methods Update

-   **File**: `assets/lib/store.ts`
-   **Changes**:
    -   `moveTaskBetweenColumns()`: Parameter `newScore` → `newPosition`
    -   `reorderTaskInColumn()`: Parameter `newScore` → `newPosition`
    -   Updated all internal references from `score` to `position`

### 3. Component Updates

-   **File**: `assets/components/custom/kanban/kanban-column.tsx`

    -   Updated task sorting: `a.score - b.score` → `a.position - b.position`

-   **File**: `assets/pages/issues-board/issues-board-page.tsx`
    -   Updated `getTasksForColumn()` sorting logic
    -   Updated drag & drop position calculations
    -   Updated method calls to use `position` instead of `score`

### 4. Mock Data Update

-   **File**: `assets/lib/mock-data.ts`
-   **Change**: All task objects updated to use `position` property instead of `score`

## Backend Requirements

The backend needs to be updated to reflect these changes:

### 1. Database Schema

Ensure the task table uses `position` column instead of `score`:

```sql
-- If migration exists with score, create new migration:
ALTER TABLE task DROP COLUMN score;
ALTER TABLE task ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
```

### 2. Task Entity Update

```php
// src/Entity/Task.php
class Task
{
    // Remove if exists:
    // private float $score;

    // Add if doesn't exist:
    #[ORM\Column(type: 'integer')]
    private int $position = 0;

    public function getPosition(): int
    {
        return $this->position;
    }

    public function setPosition(int $position): self
    {
        $this->position = $position;
        return $this;
    }
}
```

### 3. Repository Updates

Update any queries that reference `score` to use `position`:

```php
// src/Repository/TaskRepository.php
public function findByColumnOrderedByPosition(int $columnId): array
{
    return $this->createQueryBuilder('t')
        ->where('t.relatedColumn = :columnId')
        ->setParameter('columnId', $columnId)
        ->orderBy('t.position', 'ASC')  // Changed from t.score
        ->getQuery()
        ->getResult();
}
```

### 4. API Endpoints Update

Update task creation/update endpoints to handle `position`:

```php
// TaskController.php
public function createTask(Request $request): JsonResponse
{
    // ... other fields
    $position = (int) $request->get('position', 0);
    $task->setPosition($position);
    // ...
}
```

### 5. Task Column Repository

The existing eager loading query should work but verify it orders by position:

```php
// src/Repository/TaskColumnRepository.php
public function findByProjectWithTasks(int $projectId): array
{
    return $this->createQueryBuilder('c')
        ->addSelect('t')
        ->leftJoin('c.tasks', 't')
        ->where('c.project = :projectId')
        ->setParameter('projectId', $projectId)
        ->orderBy('c.score', 'ASC')
        ->addOrderBy('t.position', 'ASC')  // Ensure tasks are ordered by position
        ->getQuery()
        ->getResult();
}
```

## Validation

After backend updates:

1. Verify task creation assigns correct position values
2. Test drag & drop operations update position correctly
3. Ensure task ordering within columns works as expected
4. Check that API responses include `position` field instead of `score`

## Notes

-   Column entities still use `score` for ordering - this was not changed
-   The `useKanbanDragDrop` hook appears to be unused legacy code and still references the old structure
-   All active components now consistently use `position` for task ordering
