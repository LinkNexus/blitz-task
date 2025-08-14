import type { BoardFilters } from "@/components/custom/kanban/board-header.tsx";
import type { TaskColumn } from "@/types.ts";
import { useMemo } from "react";

export function useTaskFilters(columns: TaskColumn[], filters: BoardFilters) {
  // Get all unique users and labels from tasks for filter options
  const { availableUsers, availableLabels, allTasks } = useMemo(() => {
    const tasks = columns.flatMap(col => col.tasks || []);
    
    const users = Array.from(
      new Map(
        tasks.flatMap(task => task.assignees || [])
          .map(user => [user.id, user])
      ).values()
    );

    const labels = Array.from(
      new Map(
        tasks.flatMap(task => task.labels || [])
          .map(label => [label.id, label])
      ).values()
    );

    return { 
      availableUsers: users, 
      availableLabels: labels,
      allTasks: tasks
    };
  }, [columns]);

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    let filtered = allTasks;

    // Text search
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(task => 
        task.name.toLowerCase().includes(searchLower) ||
        task.description.toLowerCase().includes(searchLower)
      );
    }

    // Assignee filter
    if (filters.assignees.length > 0) {
      filtered = filtered.filter(task =>
        task.assignees?.some(assignee => filters.assignees.includes(assignee.id))
      );
    }

    // Label filter
    if (filters.labels.length > 0) {
      filtered = filtered.filter(task =>
        task.labels?.some(label => filters.labels.includes(label.id))
      );
    }

    // Priority filter
    if (filters.priorities.length > 0) {
      filtered = filtered.filter(task =>
        filters.priorities.includes(task.priority)
      );
    }

    // Due date filter
    if (filters.dueDateFrom || filters.dueDateTo) {
      filtered = filtered.filter(task => {
        if (!task.dueAt) return false;
        const dueDate = new Date(task.dueAt);
        
        if (filters.dueDateFrom && dueDate < filters.dueDateFrom) return false;
        if (filters.dueDateTo && dueDate > filters.dueDateTo) return false;
        
        return true;
      });
    }

    // Sort tasks
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (filters.sortBy) {
        case "name":
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case "priority":
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          aValue = priorityOrder[a.priority];
          bValue = priorityOrder[b.priority];
          break;
        case "dueAt":
          aValue = a.dueAt ? new Date(a.dueAt).getTime() : 0;
          bValue = b.dueAt ? new Date(b.dueAt).getTime() : 0;
          break;
        case "createdAt":
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return filters.sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return filters.sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [allTasks, filters]);

  // Get filtered tasks for a specific column
  const getFilteredTasksForColumn = (column: TaskColumn) => {
    const columnTasks = column.tasks || [];
    const filteredTaskIds = new Set(filteredTasks.map(task => task.id));
    
    return columnTasks
      .filter(task => filteredTaskIds.has(task.id))
      .sort((a, b) => b.score - a.score);
  };

  return {
    availableUsers,
    availableLabels,
    allTasks,
    filteredTasks,
    getFilteredTasksForColumn,
  };
}
