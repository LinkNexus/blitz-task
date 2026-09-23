import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import type { ProjectDetails } from "@/api";
import {
  createProjectSectionMutation,
  deleteProjectSectionMutation,
  getProjectQueryKey,
  updateProjectSectionMutation,
} from "@/api/@tanstack/react-query.gen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

type Props = {
  project: ProjectDetails;
  disabled: boolean;
};

const DEFAULT_COLOR = "#6366f1";

/**
 * Sections are a second way to read the board, crossing its columns (L40.5). Managed here rather
 * than on the board itself because creating one is a rare, structural act — unlike adding a
 * column, which sits on the board because it is part of using it.
 */
export function ProjectSections({ project, disabled }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  const projectId = Number(project.id);
  const queryKey = getProjectQueryKey({ path: { projectId } });
  const refresh = () => queryClient.invalidateQueries({ queryKey });

  const createSection = useMutation({
    ...createProjectSectionMutation(),
    onSuccess: () => {
      setName("");
      refresh();
    },
    onError: () => toast.error("Failed to create that section"),
  });

  const updateSection = useMutation({
    ...updateProjectSectionMutation(),
    onSuccess: refresh,
    onError: () => toast.error("Failed to save that section"),
  });

  const deleteSection = useMutation({
    ...deleteProjectSectionMutation(),
    onSuccess: () => {
      refresh();
      toast.success("Section deleted", {
        description: "Its tasks are still on the board, without a section.",
      });
    },
    onError: () => toast.error("Failed to delete that section"),
  });

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    // Highest score plus a step, so a new section lands at the end. Same scheme as columns.
    const nextScore =
      Math.max(0, ...project.sections.map((s) => Number(s.score))) + 1000;

    createSection.mutate({
      path: { projectId },
      body: { name: trimmed, color: DEFAULT_COLOR, score: nextScore },
    });
  };

  return (
    <div className="mt-8 space-y-3 border-t pt-6">
      <div className="space-y-1">
        <p className="text-sm font-medium">Sections</p>
        <p className="text-xs text-muted-foreground">
          Split this project into named parts — <code>frontend</code>,{" "}
          <code>backend</code> — and group the table by them. A task does not
          need a section, and deleting one leaves its tasks on the board.
        </p>
      </div>

      <div className="space-y-2">
        {project.sections.map((section) => (
          <div key={String(section.id)} className="flex items-center gap-2">
            <input
              type="color"
              value={section.color}
              disabled={disabled}
              onChange={(e) =>
                updateSection.mutate({
                  path: { projectId, sectionId: Number(section.id) },
                  body: {
                    name: section.name,
                    color: e.target.value,
                    score: Number(section.score),
                  },
                })
              }
              className="h-8 w-10 shrink-0 cursor-pointer rounded-md border border-input p-0.5"
              aria-label={`Colour for ${section.name}`}
            />
            <Input
              defaultValue={section.name}
              disabled={disabled}
              maxLength={60}
              className="h-8 text-sm"
              // Committed on blur rather than per keystroke: a rename is a whole word, and a
              // PATCH per character would race itself.
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (!next || next === section.name) return;
                updateSection.mutate({
                  path: { projectId, sectionId: Number(section.id) },
                  body: {
                    name: next,
                    color: section.color,
                    score: Number(section.score),
                  },
                });
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled}
              className="h-8 w-8 shrink-0 p-0 text-destructive hover:text-destructive"
              onClick={() =>
                deleteSection.mutate({
                  path: { projectId, sectionId: Number(section.id) },
                })
              }
              aria-label={`Delete ${section.name}`}
            >
              <IconTrash className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="New section"
          maxLength={60}
          disabled={disabled}
          className="h-8 text-sm"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-8 shrink-0 gap-1.5"
          disabled={disabled || !name.trim() || createSection.isPending}
          onClick={add}
        >
          {createSection.isPending ? (
            <Spinner className="size-3.5" />
          ) : (
            <IconPlus className="size-3.5" />
          )}
          Add
        </Button>
      </div>
    </div>
  );
}
