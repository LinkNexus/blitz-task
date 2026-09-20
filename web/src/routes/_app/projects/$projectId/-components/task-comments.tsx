import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Children, type ReactNode, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import type { ProjectDetails, TaskCommentDetails } from "@/api";
import {
  createTaskCommentMutation,
  deleteTaskCommentMutation,
  listTaskCommentsOptions,
  listTaskCommentsQueryKey,
  updateTaskCommentMutation,
} from "@/api/@tanstack/react-query.gen";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getInitials } from "@/lib/utils";
import { MentionTextarea } from "./mention-textarea";

type Props = {
  project: ProjectDetails;
  taskId: number;
};

/** Ceremony-free relative time, which is how a thread is read — "3 hours ago", not a date. */
function when(iso: string) {
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

/**
 * Highlights the names this comment is addressing.
 *
 * The names come from the project's participants — the same set the server matches against, so
 * what is highlighted here is exactly what produced a notification. Anything else would be a
 * second definition of what counts as a mention, and the two would drift the first time the
 * parser learned a new rule.
 *
 * Applied to text nodes only, so a name inside a code span or a link stays untouched.
 */
function highlightMentions(text: string, names: string[]): ReactNode[] {
  if (names.length === 0) return [text];

  // Longest first, mirroring the server: "@Ana Maria" must not be read as "@Ana".
  const pattern = new RegExp(
    `@(${[...names]
      .sort((a, b) => b.length - a.length)
      .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|")})(?![\\p{L}\\p{N}])`,
    "giu",
  );

  const out: ReactNode[] = [];
  let last = 0;

  for (const match of text.matchAll(pattern)) {
    const at = match.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    out.push(
      <span
        key={`${at}-${match[0]}`}
        className="rounded bg-primary/10 px-0.5 font-medium text-primary"
      >
        {match[0]}
      </span>,
    );
    last = at + match[0].length;
  }

  if (last < text.length) out.push(text.slice(last));
  return out;
}

function CommentBody({ body, names }: { body: string; names: string[] }) {
  return (
    <div className="markdown-preview prose prose-sm dark:prose-invert max-w-none break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p>
              {Children.map(children, (child) =>
                typeof child === "string"
                  ? highlightMentions(child, names)
                  : child,
              )}
            </p>
          ),
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}

function Comment({
  comment,
  projectId,
  taskId,
  names,
}: {
  comment: TaskCommentDetails;
  projectId: number;
  taskId: number;
  names: string[];
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<string | null>(null);
  const queryKey = listTaskCommentsQueryKey({ path: { projectId, taskId } });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const update = useMutation({
    ...updateTaskCommentMutation(),
    onSuccess: () => {
      setDraft(null);
      invalidate();
    },
    onError: () => toast.error("Failed to save the comment"),
  });

  const remove = useMutation({
    ...deleteTaskCommentMutation(),
    onSuccess: invalidate,
    onError: () => toast.error("Failed to delete the comment"),
  });

  const isEditing = draft !== null;

  return (
    <li className="flex gap-3">
      <Avatar className="size-7 shrink-0">
        <AvatarFallback className="text-[11px]">
          {getInitials(comment.authorName)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
          <span className="font-medium text-foreground">
            {comment.authorName}
          </span>
          <span className="text-muted-foreground">
            {when(comment.createdAt)}
          </span>
          {/* Said plainly rather than shown as a diff: the point is only that what is on screen
              is not what was originally written. */}
          {comment.isEdited && (
            <span className="text-muted-foreground">(edited)</span>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <MentionTextarea
              value={draft}
              onChange={setDraft}
              names={names}
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={!draft.trim() || update.isPending}
                onClick={() =>
                  update.mutate({
                    path: { projectId, taskId, commentId: Number(comment.id) },
                    body: { body: draft },
                  })
                }
              >
                {update.isPending && <Spinner className="size-3.5" />}
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setDraft(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <CommentBody body={comment.body} names={names} />

            {/* canEdit and canDelete come from the server per row and are deliberately not the
                same answer: someone who runs the project may take a remark down, never reword
                it. Mirroring that rule here in TypeScript would be a second copy of it. */}
            {(comment.canEdit || comment.canDelete) && (
              <div className="flex gap-3 text-xs text-muted-foreground">
                {comment.canEdit && (
                  <button
                    type="button"
                    className="hover:text-foreground"
                    onClick={() => setDraft(comment.body)}
                  >
                    Edit
                  </button>
                )}
                {comment.canDelete && (
                  <button
                    type="button"
                    className="hover:text-destructive"
                    disabled={remove.isPending}
                    onClick={() =>
                      remove.mutate({
                        path: {
                          projectId,
                          taskId,
                          commentId: Number(comment.id),
                        },
                      })
                    }
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </li>
  );
}

/**
 * The discussion on one task.
 *
 * Read separately from the task rather than carried on it, the way reminders are: a thread only
 * grows, and the board's payload already contains every task of the project in full.
 *
 * Note there is no `<form>` here, deliberately — this renders *inside* the task sheet's own
 * form, and a nested one would make the composer's button save the task instead.
 */
export function TaskComments({ project, taskId }: Props) {
  const projectId = Number(project.id);
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");

  const canComment = project.userPermissions?.includes("Comment") ?? false;
  const participantNames = project.participants.map((p) => p.name);

  const { data: comments, isLoading } = useQuery(
    listTaskCommentsOptions({ path: { projectId, taskId } }),
  );

  const create = useMutation({
    ...createTaskCommentMutation(),
    onSuccess: () => {
      setBody("");
      queryClient.invalidateQueries({
        queryKey: listTaskCommentsQueryKey({ path: { projectId, taskId } }),
      });
    },
    onError: () => toast.error("Failed to post the comment"),
  });

  return (
    <div className="space-y-3 border-t pt-5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">Comments</span>
        {!!comments?.length && (
          <span className="text-xs text-muted-foreground">
            {comments.length}
          </span>
        )}
      </div>

      {isLoading ? (
        <Spinner className="size-4" />
      ) : comments?.length ? (
        <ul className="space-y-4">
          {comments.map((comment) => (
            <Comment
              key={String(comment.id)}
              comment={comment}
              projectId={projectId}
              taskId={taskId}
              names={participantNames}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      )}

      {/* A Viewer reads the thread but does not join it — there is no commenter tier between
          the two, so the read-only role stays read-only. */}
      {canComment && (
        <div className="space-y-2">
          <MentionTextarea
            value={body}
            onChange={setBody}
            names={participantNames}
            placeholder="Leave a comment. Markdown is supported, and @ mentions someone."
            rows={3}
          />
          <Button
            type="button"
            size="sm"
            disabled={!body.trim() || create.isPending}
            onClick={() =>
              create.mutate({ path: { projectId, taskId }, body: { body } })
            }
          >
            {create.isPending && <Spinner className="size-3.5" />}
            Comment
          </Button>
        </div>
      )}
    </div>
  );
}
