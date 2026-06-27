import {
  IconFile,
  IconFileText,
  IconFileZip,
  IconMusic,
  IconPencil,
  IconPhoto,
  IconUpload,
  IconVideo,
  IconX,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { DropEvent, DropzoneOptions, FileRejection } from "react-dropzone";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const renderBytes = (bytes: number) => {
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`;
};

function getFileIcon(file: File) {
  const { type } = file;
  if (type.startsWith("image/")) return IconPhoto;
  if (type.startsWith("video/")) return IconVideo;
  if (type.startsWith("audio/")) return IconMusic;
  if (type === "application/pdf") return IconFileText;
  if (
    type === "application/zip" ||
    type === "application/x-tar" ||
    type === "application/x-rar-compressed" ||
    type === "application/gzip"
  )
    return IconFileZip;
  if (type.startsWith("text/")) return IconFileText;
  return IconFile;
}

interface DropzoneContextType {
  src?: File[];
  accept?: DropzoneOptions["accept"];
  maxSize?: DropzoneOptions["maxSize"];
  minSize?: DropzoneOptions["minSize"];
  maxFiles?: DropzoneOptions["maxFiles"];
}

const DropzoneContext = createContext<DropzoneContextType | undefined>(
  undefined,
);

const useDropzoneContext = () => {
  const context = useContext(DropzoneContext);
  if (!context)
    throw new Error("useDropzoneContext must be used within a Dropzone");
  return context;
};

export type DropzoneProps = Omit<DropzoneOptions, "onDrop"> & {
  src?: File[];
  className?: string;
  onDrop?: (
    acceptedFiles: File[],
    fileRejections: FileRejection[],
    event: DropEvent,
  ) => void;
  children?: ReactNode;
};

export const Dropzone = ({
  accept,
  maxFiles = 1,
  maxSize,
  minSize,
  onDrop,
  onError,
  disabled,
  src,
  className,
  children,
  ...props
}: DropzoneProps) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    maxFiles,
    maxSize,
    minSize,
    onError,
    disabled,
    onDrop: (acceptedFiles, fileRejections, event) => {
      if (fileRejections.length > 0) {
        const message = fileRejections.at(0)?.errors.at(0)?.message;
        onError?.(new Error(message));
        return;
      }
      onDrop?.(acceptedFiles, fileRejections, event);
    },
    ...props,
  });

  return (
    <DropzoneContext.Provider
      key={JSON.stringify(src)}
      value={{ src, accept, maxSize, minSize, maxFiles }}
    >
      <Button
        className={cn(
          "relative h-auto w-full flex-col overflow-hidden border-dashed p-6 transition-colors",
          isDragActive && "border-ring bg-ring/5 ring-1 ring-ring",
          className,
        )}
        disabled={disabled}
        type="button"
        variant="outline"
        {...getRootProps()}
      >
        <input {...getInputProps()} disabled={disabled} />
        {children}
      </Button>
    </DropzoneContext.Provider>
  );
};

export interface DropzoneEmptyStateProps {
  children?: ReactNode;
  className?: string;
}

export const DropzoneEmptyState = ({
  children,
  className,
}: DropzoneEmptyStateProps) => {
  const { src, accept, maxSize, minSize, maxFiles } = useDropzoneContext();

  if (src?.length) return null;
  if (children) return <>{children}</>;

  const extensions = accept
    ? [...new Set(Object.values(accept).flat())]
    : [];

  let sizeHint = "";
  if (minSize && maxSize) {
    sizeHint = `${renderBytes(minSize)} – ${renderBytes(maxSize)}`;
  } else if (minSize) {
    sizeHint = `≥ ${renderBytes(minSize)}`;
  } else if (maxSize) {
    sizeHint = `≤ ${renderBytes(maxSize)}`;
  }

  return (
    <div className={cn("flex flex-col items-center gap-2 py-2", className)}>
      <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <IconUpload size={18} />
      </div>
      <div className="flex flex-col items-center gap-1.5 text-center">
        <p className="text-sm font-medium">
          {maxFiles === 1 ? "Upload a file" : "Upload files"}
        </p>
        <p className="text-xs text-muted-foreground">
          Drag &amp; drop or click to browse
        </p>
        {(extensions.length > 0 || sizeHint) && (
          <div className="flex flex-wrap justify-center gap-1">
            {extensions.map((ext) => (
              <span
                key={ext}
                className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground"
              >
                {ext}
              </span>
            ))}
            {sizeHint && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {sizeHint}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export interface DropzoneContentProps {
  children?: ReactNode;
  className?: string;
}

export const DropzoneContent = ({
  children,
  className,
}: DropzoneContentProps) => {
  const { src, maxFiles } = useDropzoneContext();

  if (!src?.length) return null;
  if (children) return <>{children}</>;

  const canAddMore = maxFiles === undefined || src.length < maxFiles;

  return (
    <div className={cn("flex flex-col items-center gap-1.5 py-1", className)}>
      <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <IconUpload size={18} />
      </div>
      <p className="text-xs text-muted-foreground">
        {canAddMore
          ? "Drop more files or click to browse"
          : "Drop a file or click to replace"}
      </p>
    </div>
  );
};

interface DropzoneFileItemProps {
  file: File;
  onRemove: () => void;
  onRename: (newName: string) => void;
}

function DropzoneFileItem({ file, onRemove, onRename }: DropzoneFileItemProps) {
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(file.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const isImage = file.type.startsWith("image/");
  const previewUrl = useMemo(
    () => (isImage ? URL.createObjectURL(file) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [file],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const FileIcon = getFileIcon(file);

  const commitRename = () => {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== file.name) {
      onRename(trimmed);
    } else {
      setNameInput(file.name);
    }
    setEditing(false);
  };

  return (
    <li className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
      {/* Thumbnail / icon */}
      {isImage && previewUrl ? (
        <img
          src={previewUrl}
          alt={file.name}
          className="size-10 shrink-0 rounded-md object-cover"
        />
      ) : (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <FileIcon className="size-5" />
        </div>
      )}

      {/* Name + size */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {editing ? (
          <Input
            ref={inputRef}
            className="h-6 rounded-none border-0 border-b px-0 py-0 text-sm font-medium shadow-none focus-visible:ring-0"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setNameInput(file.name);
                setEditing(false);
              }
              e.stopPropagation();
            }}
          />
        ) : (
          <button
            type="button"
            className="truncate text-left text-sm font-medium underline-offset-2 hover:underline focus:outline-none"
            title="Click to rename"
            onClick={() => setEditing(true)}
          >
            {file.name}
          </button>
        )}
        <span className="text-xs text-muted-foreground">
          {renderBytes(file.size)}
        </span>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => setEditing(true)}
          aria-label="Rename file"
        >
          <IconPencil className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          aria-label="Remove file"
        >
          <IconX className="size-3.5" />
        </Button>
      </div>
    </li>
  );
}

export interface DropzoneFileListProps {
  files: File[];
  onRemove: (file: File) => void;
  onRename: (file: File, newName: string) => void;
  className?: string;
}

export const DropzoneFileList = ({
  files,
  onRemove,
  onRename,
  className,
}: DropzoneFileListProps) => {
  if (!files.length) return null;

  return (
    <ul className={cn("flex flex-col gap-2", className)}>
      {files.map((file) => (
        <DropzoneFileItem
          key={`${file.name}-${file.size}-${file.lastModified}`}
          file={file}
          onRemove={() => onRemove(file)}
          onRename={(newName) => onRename(file, newName)}
        />
      ))}
    </ul>
  );
};
