# Improved Drag & Drop Positioning

## What Was Changed

Updated the drag and drop logic to insert tasks at the exact position where the user drops them, rather than always placing them at the bottom of the target column.

## New Behavior

### 1. Dropping on Empty Column Area

-   **Before**: Task placed at bottom
-   **After**: Task placed at bottom (unchanged - this is correct for empty areas)

### 2. Dropping on Specific Task

-   **Before**: Task replaced target task's position exactly
-   **After**: Task inserted at the appropriate position relative to the target task

### 3. Position Calculation Logic

#### Same Column Reordering

```typescript
if (sourceIndex < targetIndex) {
    // Moving down: place after target task
    newPosition = targetTask.position + 0.5;
} else {
    // Moving up: place before target task
    newPosition = targetTask.position - 0.5;
}
```

#### Cross-Column Movement

```typescript
if (targetIndex === 0) {
    // Inserting at the beginning
    newPosition = targetTask.position - 0.5;
} else {
    // Inserting between tasks
    const prevTask = targetColumnTasks[targetIndex - 1];
    newPosition = (prevTask.position + targetTask.position) / 2;
}
```

## Position Normalization

Added automatic position normalization to prevent fractional values from accumulating:

### Store Method Added

```typescript
normalizeTaskPositions: (projectId: number, columnId: number) => {
    // Sorts tasks by position and reassigns clean integer positions (0, 1, 2, etc.)
};
```

### Automatic Cleanup

-   Called after every drag operation using `setTimeout(() => {}, 0)`
-   Ensures positions remain clean integers over time
-   Prevents precision issues with fractional positioning

## User Experience Improvements

### Visual Feedback

-   Tasks now insert exactly where the user expects them to
-   More intuitive drag and drop behavior
-   Consistent with common kanban board expectations

### Technical Benefits

-   Clean position values maintained automatically
-   No accumulation of fractional positions
-   Stable sorting behavior

## Example Scenarios

### Scenario 1: Insert Between Tasks

```
Before:  [Task A: pos 0] [Task B: pos 1] [Task C: pos 2]
Drop on: Task B (from another column)
Result:  [Task A: pos 0] [NEW: pos 0.5] [Task B: pos 1] [Task C: pos 2]
After normalization: [Task A: pos 0] [NEW: pos 1] [Task B: pos 2] [Task C: pos 3]
```

### Scenario 2: Insert at Beginning

```
Before:  [Task A: pos 0] [Task B: pos 1] [Task C: pos 2]
Drop on: Task A (from another column)
Result:  [NEW: pos -0.5] [Task A: pos 0] [Task B: pos 1] [Task C: pos 2]
After normalization: [NEW: pos 0] [Task A: pos 1] [Task B: pos 2] [Task C: pos 3]
```

### Scenario 3: Reorder Within Column

```
Before:  [Task A: pos 0] [Task B: pos 1] [Task C: pos 2]
Move:    Task C to position of Task A
Result:  [Task C: pos -0.5] [Task A: pos 0] [Task B: pos 1]
After normalization: [Task C: pos 0] [Task A: pos 1] [Task B: pos 2]
```

## Implementation Notes

-   Uses fractional positions temporarily for immediate feedback
-   Normalizes to integers after operations complete
-   Maintains proper sort order throughout the process
-   Handles edge cases (beginning, end, between tasks)

This creates a much more intuitive and professional drag & drop experience that matches user expectations from modern kanban tools.
