import {Button} from "@/components/ui/button.tsx";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card.tsx";
import {Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,} from "@/components/ui/dialog.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {Input} from "@/components/ui/input.tsx";
import {apiFetch} from "@/lib/fetch.ts";
import type {Attachment, Task} from "@/types.ts";
import {
  Archive,
  Download,
  ExternalLink,
  File,
  FileText,
  Image,
  MoreHorizontal,
  Paperclip,
  Trash2,
  Upload
} from "lucide-react";
import {useRef, useState} from "react";
import {toast} from "sonner";
import {useApiFetch} from "@/hooks/useApiFetch.ts";

interface TaskAttachmentsProps {
  task: Task;
  onAttachmentAdd: (attachment: Attachment) => void;
  onAttachmentDelete: (attachmentId: number) => void;
}

function getFileIcon(fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
    return <Image className="w-4 h-4"/>;
  } else if (['pdf', 'doc', 'docx', 'txt'].includes(extension)) {
    return <FileText className="w-4 h-4"/>;
  } else if (['zip', 'rar', 'tar', 'gz'].includes(extension)) {
    return <Archive className="w-4 h-4"/>;
  } else {
    return <File className="w-4 h-4"/>;
  }
}

export function TaskAttachments({task, onAttachmentAdd, onAttachmentDelete}: TaskAttachmentsProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const attachments = task.attachments || [];

  const {} = useApiFetch(`/api/attachments/upload?taskId=${task.id}`, {
    onSuccess(data: Attachment[]) {
      data.forEach(attachment => onAttachmentAdd(attachment))
    },
    onError(error) {
      console.error("Failed to fetch attachments:", error);
    }
  })

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();

    try {
      setUploading(true);

      for (const file of files) {
        formData.append('files[]', file);
        formData.append('taskId', task.id.toString());

        const attachment = await apiFetch<Attachment>("/api/attachments/upload", {
          method: "POST",
          data: formData,
        });

        onAttachmentAdd(attachment);
      }

      toast.success(`${files.length} file(s) uploaded successfully`);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error("Failed to upload files:", error);
      toast.error("Failed to upload files");
    } finally {
      setUploading(false);
    }
  };

  const handleLinkAdd = async () => {
    if (!linkName.trim() || !linkUrl.trim()) {
      toast.error("Please provide both name and URL");
      return;
    }

    try {
      setUploading(true);

      const attachment = await apiFetch<Attachment>("/api/attachments", {
        method: "POST",
        data: {
          name: linkName,
          link: linkUrl,
          taskId: task.id,
        },
      });

      onAttachmentAdd(attachment);
      setLinkName("");
      setLinkUrl("");
      setUploadDialogOpen(false);
      toast.success("Link added successfully");
    } catch (error) {
      console.error("Failed to add link:", error);
      toast.error("Failed to add link");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (attachmentId: number) => {
    try {
      await apiFetch(`/api/attachments/${attachmentId}`, {
        method: "DELETE",
      });

      onAttachmentDelete(attachmentId);
      toast.success("Attachment deleted");
    } catch (error) {
      console.error("Failed to delete attachment:", error);
      toast.error("Failed to delete attachment");
    }
  };

  const handleDownload = (attachment: Attachment) => {
    window.open(attachment.link, '_blank');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Paperclip className="w-5 h-5"/>
            Attachments ({attachments.length})
          </CardTitle>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              size="sm"
              disabled={uploading}
            >
              <Upload className="w-4 h-4 mr-2"/>
              Upload
            </Button>

            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <ExternalLink className="w-4 h-4 mr-2"/>
                  Add Link
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Link</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Name</label>
                    <Input
                      value={linkName}
                      onChange={(e) => setLinkName(e.target.value)}
                      placeholder="Link name"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">URL</label>
                    <Input
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https://..."
                      type="url"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      onClick={() => setUploadDialogOpen(false)}
                      variant="outline"
                      disabled={uploading}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleLinkAdd}
                      disabled={uploading || !linkName.trim() || !linkUrl.trim()}
                    >
                      {uploading ? "Adding..." : "Add Link"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileUpload}
        className="hidden"
      />

      <CardContent>
        {attachments.length > 0 ? (
          <div className="space-y-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
              >
                <div className="flex items-center gap-3 flex-1">
                  {getFileIcon(attachment.name)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{attachment.name}</p>
                    {attachment.link.startsWith('http') ? (
                      <p className="text-xs text-muted-foreground truncate">
                        {attachment.link}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        File attachment
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => handleDownload(attachment)}
                    variant="ghost"
                    size="sm"
                  >
                    <Download className="w-4 h-4"/>
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="w-4 h-4"/>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleDownload(attachment)}>
                        <ExternalLink className="w-4 h-4 mr-2"/>
                        Open
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(attachment.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2"/>
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Paperclip className="w-12 h-12 mx-auto mb-4 opacity-50"/>
            <p>No attachments yet.</p>
            <p className="text-sm">Upload files or add links to get started.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
