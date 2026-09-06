import { Skeleton } from "@/components/ui/skeleton";

/** Pending state for the Today and Upcoming routes: a header and a stack of rows. */
export const TaskListSkeleton = () => (
  <div className="space-y-6">
    <div className="space-y-2">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-4 w-56" />
    </div>

    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      {[1, 2, 3, 4, 5].map((row) => (
        <Skeleton key={row} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  </div>
);
