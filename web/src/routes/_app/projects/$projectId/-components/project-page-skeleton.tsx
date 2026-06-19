import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export const ProjectPageSkeleton = () => {
  return (
    <div className="space-y-4">
      {/* Title row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <Skeleton className="size-12 shrink-0 rounded-full" />
          <div className="space-y-2 min-w-0">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-80" />
          </div>
        </div>
        <Skeleton className="size-8 shrink-0 rounded-md" />
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-x-5 gap-y-2 flex-wrap">
        <Skeleton className="h-4 w-40" />
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
        <div className="ml-auto flex -space-x-2">
          <Skeleton className="size-6 rounded-full ring-2 ring-background" />
          <Skeleton className="size-6 rounded-full ring-2 ring-background" />
          <Skeleton className="size-6 rounded-full ring-2 ring-background" />
        </div>
      </div>

      <Separator />

      {/* Kanban board placeholder */}
      <div className="flex gap-4 pt-2">
        {[1, 2, 3].map((col) => (
          <div key={col} className="flex flex-col gap-3 w-72 shrink-0">
            <Skeleton className="h-6 w-24 rounded-md" />
            {[1, 2, 3].map((card) => (
              <Skeleton key={card} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
