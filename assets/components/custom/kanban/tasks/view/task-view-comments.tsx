import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar.tsx";
import {Badge} from "@/components/ui/badge.tsx";
import {Button} from "@/components/ui/button.tsx";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {Separator} from "@/components/ui/separator.tsx";
import {Textarea} from "@/components/ui/textarea.tsx";
import {ApiError} from "@/lib/fetch.ts";
import type {Comment} from "@/types.ts";
import {Copy, Edit, Loader, MessageSquare, MoreHorizontal, Paperclip, Save, Send, Trash2, X} from "lucide-react";
import {memo, useCallback, useEffect, useRef, useState} from "react";
import {toast} from "sonner";
import {useApiFetch} from "@/hooks/useApiFetch.ts";
import {useAccount} from "@/hooks/useAccount.ts";

interface TaskCommentsProps {
  id: number;
  comments: Comment[] | undefined | null;
  onCommentAdd: (comment: Comment) => void;
  onCommentUpdate: (comment: Comment) => void;
  onCommentsFetch: (comments: Comment[]) => void;
  onCommentDelete: (commentId: number) => void;
}

interface CommentItemProps {
  comment: Comment;
  onUpdate: (comment: Comment) => void;
  onDelete: (commentId: number) => void;
}

function CommentItem({comment, onUpdate, onDelete}: CommentItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(comment.content);
  const trimmedContent = editedContent.trim();
  const {user} = useAccount();

  const {pending: saving, callback: updateComment} = useApiFetch<Comment, {
    message: string
  }>(`/api/comments/${comment.id}`, {
    data: {
      content: trimmedContent
    },
    condition: trimmedContent && trimmedContent !== comment.content && comment.author.id === user.id,
    method: "PATCH",
    onSuccess(data) {
      onUpdate(data)
      toast.success("Comment updated");
      setIsEditing(false);
      setEditedContent(data.content);
    },
    onError(err) {
      toast.error("Failed to update comment: " + err.data.message, {
        closeButton: true,
      })
      console.error("Failed to update comment:", err);
    }
  }, [comment.id, trimmedContent, onUpdate, comment.content]);

  const {pending: deleting, callback: deleteComment} = useApiFetch<null, {
    message: string
  }>(`/api/comments/${comment.id}`, {
    method: "DELETE",
    onSuccess() {
      onDelete(comment.id);
      toast.success("Comment deleted");
    },
    onError(err) {
      toast.error("Failed to delete comment: " + err.data.message, {
        closeButton: true,
      })
      console.error("Failed to delete comment:", err);
    }
  })

  const handleCancel = () => {
    setEditedContent(comment.content);
    setIsEditing(false);
  };

  const handleCopy = useCallback(async function () {
    await navigator.clipboard.writeText(comment.content).then(() => {
      toast.success("Comment copied to clipboard");
    }).catch(err => {
      console.error("Failed to copy comment to clipboard:", err);
      toast.error("Failed to copy comment to clipboard");
    });
  }, [comment.content]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start space-x-3">
        <Avatar className="w-8 h-8">
          <AvatarImage src={`/avatars/${comment.author.id}.jpg`}/>
          <AvatarFallback className="text-xs">
            {comment.author.name.split(" ").map(n => n[0]).join("")}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-sm">{comment.author.name}</span>
              <span className="text-xs text-muted-foreground">
                {formatDate(comment.createdAt)}
              </span>
              {comment.createdAt !== comment.updatedAt && (
                <Badge variant="secondary" className="text-xs">
                  edited
                </Badge>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <MoreHorizontal className="w-4 h-4"/>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleCopy} className="text-muted-foreground">
                  <Copy className="size-4 mr-2"/>
                  Copy
                </DropdownMenuItem>
                {user.id === comment.author.id && (
                  <>
                    <DropdownMenuItem onClick={() => setIsEditing(true)}>
                      <Edit className="w-4 h-4 mr-2"/>
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={async () => await deleteComment()}
                      className="text-destructive"
                      disabled={deleting}
                    >
                      <Trash2 className="w-4 h-4 mr-2"/>
                      {deleting ? "Deleting..." : "Delete"}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                rows={3}
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    await updateComment();
                  }
                }}
              />
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => updateComment()}
                  size="sm"
                  disabled={saving || !trimmedContent || comment.content === trimmedContent}
                >
                  <Save className="w-4 h-4 mr-2"/>
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  size="sm"
                  disabled={saving}
                >
                  <X className="w-4 h-4 mr-2"/>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm whitespace-pre-wrap">{comment.content}</div>
          )}

          {/* Comment attachments */}
          {comment.attachments.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Paperclip className="w-3 h-3"/>
                Attachments
              </div>
              <div className="grid gap-2">
                {comment.attachments.map((attachment) => (
                  <a
                    key={attachment.id}
                    href={attachment.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 border rounded-md hover:bg-muted text-sm"
                  >
                    <Paperclip className="w-4 h-4 text-muted-foreground"/>
                    {attachment.name}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const TaskViewComments = memo(function ({
  id,
  comments,
  onCommentAdd,
  onCommentUpdate,
  onCommentDelete,
  onCommentsFetch
}: TaskCommentsProps) {
  const [content, setContent] = useState("");
  const trimmedContent = content.trim();
  const ref = useRef<HTMLDivElement>(null);

  const {callback: getComments} = useApiFetch(`/api/comments?taskId=${id}`, {
    onSuccess: onCommentsFetch,
    onError(err: ApiError<{ message: string }>) {
      toast.error(err.data.message, {
        closeButton: true
      });
    }
  }, [id])

  useEffect(() => {
    const observer = new IntersectionObserver(async function () {
      if (!comments)
        await getComments();
    });

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [comments]);

  const {pending: submitting, callback: submitComment} = useApiFetch(`/api/comments?taskId=${id}`, {
    data: {
      content: trimmedContent
    },
    onSuccess(data: Comment) {
      onCommentAdd(data)
      setContent("");
      toast.success("Comment added");
    },
    onError(err) {
      console.error("Failed to add comment:", err);
      toast.error("Failed to add comment");
    }
  }, [trimmedContent, id, onCommentAdd]);

  return (
    <Card ref={ref}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {comments ? <>
              <MessageSquare className="w-5 h-5"/>
              Comments ({comments.length})
            </>
            : <>
              <Loader className="size-6 animate-spin"/>
              Loading Comments...
            </>
          }
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add new comment */}
        <div className="space-y-3">
          <Textarea
            onKeyDown={async (e) => {
              if (e.key === "Enter" && !e.shiftKey && trimmedContent) {
                e.preventDefault();
                await submitComment();
              }
            }}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Add a comment..."
            rows={3}
            // className="resize-none"
          />
          <div className="flex justify-end">
            <Button
              onClick={async () => {
                if (trimmedContent) {
                  await submitComment()
                }
              }}
              disabled={submitting || !content.trim()}
              size="sm"
            >
              <Send className="w-4 h-4 mr-2"/>
              {submitting ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </div>

        {!comments ? (
            <div className="w-full flex justify-center align-center">
              <Loader className="size-10 animate-spin"/>
            </div>
          )
          : comments.length > 0 ? (
            <div className="space-y-6">
              <Separator/>
              {comments.map((comment, index) => (
                <div key={comment.id}>
                  <CommentItem
                    comment={comment}
                    onUpdate={onCommentUpdate}
                    onDelete={onCommentDelete}
                  />
                  {index < comments.length - 1 && <Separator className="mt-4"/>}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50"/>
              <p>No comments yet. Be the first to add one!</p>
            </div>
          )}
      </CardContent>
    </Card>
  );
});
