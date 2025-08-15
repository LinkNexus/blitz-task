import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { apiFetch } from "@/lib/fetch.ts";
import type { Comment, Task } from "@/types.ts";
import {
    Edit,
    MessageSquare,
    MoreHorizontal,
    Paperclip,
    Save,
    Send,
    Trash2,
    X
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface TaskCommentsProps {
  task: Task;
  onCommentAdd: (comment: Comment) => void;
  onCommentUpdate: (comment: Comment) => void;
  onCommentDelete: (commentId: number) => void;
}

interface CommentItemProps {
  comment: Comment;
  onUpdate: (comment: Comment) => void;
  onDelete: (commentId: number) => void;
}

function CommentItem({ comment, onUpdate, onDelete }: CommentItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(comment.content);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const updatedComment = await apiFetch<Comment>(`/api/comments/${comment.id}`, {
        method: "PATCH",
        data: { content: editedContent },
      });

      onUpdate(updatedComment);
      setIsEditing(false);
      toast.success("Comment updated");
    } catch (error) {
      console.error("Failed to update comment:", error);
      toast.error("Failed to update comment");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      
      await apiFetch(`/api/comments/${comment.id}`, {
        method: "DELETE",
      });

      onDelete(comment.id);
      toast.success("Comment deleted");
    } catch (error) {
      console.error("Failed to delete comment:", error);
      toast.error("Failed to delete comment");
    } finally {
      setDeleting(false);
    }
  };

  const handleCancel = () => {
    setEditedContent(comment.content);
    setIsEditing(false);
  };

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
          <AvatarImage src={`/avatars/${comment.author.id}.jpg`} />
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
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsEditing(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleDelete}
                  className="text-destructive"
                  disabled={deleting}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {deleting ? "Deleting..." : "Delete"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                rows={3}
                className="resize-none"
              />
              <div className="flex items-center gap-2">
                <Button 
                  onClick={handleSave} 
                  size="sm" 
                  disabled={saving || !editedContent.trim()}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button 
                  onClick={handleCancel} 
                  variant="outline" 
                  size="sm"
                  disabled={saving}
                >
                  <X className="w-4 h-4 mr-2" />
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
                <Paperclip className="w-3 h-3" />
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
                    <Paperclip className="w-4 h-4 text-muted-foreground" />
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

export function TaskComments({ task, onCommentAdd, onCommentUpdate, onCommentDelete }: TaskCommentsProps) {
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;

    try {
      setSubmitting(true);
      
      const comment = await apiFetch<Comment>("/api/comments", {
        method: "POST",
        data: {
          content: newComment,
          taskId: task.id,
        },
      });

      onCommentAdd(comment);
      setNewComment("");
      toast.success("Comment added");
    } catch (error) {
      console.error("Failed to add comment:", error);
      toast.error("Failed to add comment");
    } finally {
      setSubmitting(false);
    }
  };

  const comments = task.comments || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Comments ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add new comment */}
        <div className="space-y-3">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            rows={3}
            className="resize-none"
          />
          <div className="flex justify-end">
            <Button 
              onClick={handleSubmit}
              disabled={submitting || !newComment.trim()}
              size="sm"
            >
              <Send className="w-4 h-4 mr-2" />
              {submitting ? "Adding..." : "Add Comment"}
            </Button>
          </div>
        </div>

        {/* Comments list */}
        {comments.length > 0 ? (
          <div className="space-y-6">
            <Separator />
            {comments.map((comment, index) => (
              <div key={comment.id}>
                <CommentItem
                  comment={comment}
                  onUpdate={onCommentUpdate}
                  onDelete={onCommentDelete}
                />
                {index < comments.length - 1 && <Separator className="mt-4" />}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No comments yet. Be the first to add one!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
