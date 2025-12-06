import {type Dispatch, type SetStateAction, useEffect} from "react";
import type {Task, TaskColumn} from "@/types.ts";

export function useColumnsCrudEvents(setColumns: Dispatch<SetStateAction<TaskColumn[]>>) {
  useEffect(() => {
    const createColumn: EventListener = (event) => {
      const score = (event as CustomEvent<{ score: number }>).detail.score;
      console.log(score);
      setColumns(columns => {
        return [
          ...columns,
          {
            id: Date.now(),
            name: "",
            score,
            tasks: [] as Task[],
            isNotPersisted: true
          } as TaskColumn
        ]
      })
    }

    const handleColumnCreated: EventListener = (event) => {
      const column = (event as CustomEvent<TaskColumn>).detail;
      setColumns(columns => {
        return columns.map(c => {
          if (c.isNotPersisted)
            return {...c, isNotPersisted: false, id: column.id};
          return c;
        })
      })
    }

    const handleColumnRenamed: EventListener = (event) => {
      const newName = (event as CustomEvent<{ newName: string }>).detail.newName;
      const columnId = (event as CustomEvent<{ id: number }>).detail.id;
      setColumns(columns => columns.map(c => c.id === columnId ? {...c, name: newName} : c));
    }

    const handleColumnDeleted: EventListener = (event) => {
      const columnId = (event as CustomEvent<{ id: number }>).detail.id;
      setColumns(columns => columns.filter(c => c.id !== columnId));
    }

    document.addEventListener("column.create", createColumn);
    document.addEventListener("column.deleted", handleColumnDeleted);
    document.addEventListener("column.renamed", handleColumnRenamed);
    document.addEventListener("column.created", handleColumnCreated);

    return function () {
      document.removeEventListener("column.create", createColumn);
      document.removeEventListener("column.deleted", handleColumnDeleted);
      document.removeEventListener("column.renamed", handleColumnRenamed);
      document.removeEventListener("column.created", handleColumnCreated);
    }
  }, []);

}
