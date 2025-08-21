import {Button} from "@/components/ui/button.tsx";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {apiFetch} from "@/lib/fetch.ts";
import type {Attachment} from "@/types.ts";
import {Archive, Download, ExternalLink, File, FileText, MoreHorizontal, Paperclip, Trash2, Upload} from "lucide-react";
import {type ChangeEvent, memo, useRef, useState} from "react";
import {toast} from "sonner";
import {useApiFetch} from "@/hooks/useApiFetch.ts";
import {allowedMimeTypes} from "@/lib/allowed-mime-types.ts";

interface TaskAttachmentsProps {
  id: number;
  attachments: Attachment[];
  onAttachmentAdd: (attachment: Attachment) => void;
  onAttachmentDelete: (attachmentId: number) => void;
}

function getFileIcon(attachment: Attachment) {
  const extension = attachment.name.split('.').pop()?.toLowerCase() || '';

  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
    return <img alt={attachment.name} src={attachment.link} className="w-10 aspect-square"/>;
  } else if (['pdf', 'doc', 'docx', 'txt'].includes(extension)) {
    return <FileText className="w-4 h-4"/>;
  } else if (['zip', 'rar', 'tar', 'gz'].includes(extension)) {
    return <Archive className="w-4 h-4"/>;
  } else {
    return <File className="w-4 h-4"/>;
  }
}

export const TaskAttachments = memo(function ({
  id,
  attachments,
  onAttachmentAdd,
  onAttachmentDelete
}: TaskAttachmentsProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {callback: uploadFiles} = useApiFetch(`/api/tasks/${id}/add-attachment`, {
    onSuccess(data: Attachment[]) {
      data.forEach(attachment => onAttachmentAdd(attachment))
      toast.success(`${data.length} attachment(s) added successfully`);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    onError(error) {
      console.error("Failed to upload files:", error);
      toast.error("Failed to upload files");
    },
    finally: () => setUploading(false)
  }, [id]);

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (const file of files) {
      formData.append('files[]', file);
    }

    await uploadFiles({data: formData});
  };

  const handleDelete = async (attachmentId: number) => {
    await apiFetch(`/api/attachments/${attachmentId}`, {
      method: "DELETE",
    })
      .then(() => {
        onAttachmentDelete(attachmentId);
        toast.success("Attachment deleted")
      })
      .catch(err => {
        console.error("Failed to delete attachment:", err);
        toast.error("Failed to delete attachment");
      })
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
          </div>
        </div>
      </CardHeader>

      <input
        ref={fileInputRef}
        accept={allowedMimeTypes.join(",")}
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
                  {getFileIcon(attachment)}
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
});
