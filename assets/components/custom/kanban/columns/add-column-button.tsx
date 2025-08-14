import {Button} from "@/components/ui/button.tsx";
import {Plus} from "lucide-react";
import type {ComponentPropsWithoutRef} from "react";

export function AddColumnButton({onClick}: ComponentPropsWithoutRef<"div">) {
  return (
    <div className="flex flex-col min-w-[280px] sm:min-w-[300px] flex-shrink-0" onClick={onClick}>
      <div className="flex items-center justify-center mb-3 sm:mb-4 p-2 sm:p-3">
        <h3 className="font-semibold text-xs sm:text-sm text-muted-foreground">Add Column</h3>
      </div>
      <Button
        variant="outline"
        className="flex-1 min-h-[400px] sm:min-h-[500px] border-2 border-dashed hover:bg-muted/50 transition-colors text-xs sm:text-sm"
      >
        <Plus className="w-5 h-5 sm:w-6 sm:h-6 mr-1 sm:mr-2"/>
        Add Column
      </Button>
    </div>
  );
}
