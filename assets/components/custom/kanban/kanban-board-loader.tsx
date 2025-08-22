import {memo} from "react";
import {Skeleton} from "@/components/ui/skeleton.tsx";
import {Button} from "@/components/ui/button.tsx";
import {Badge} from "@/components/ui/badge.tsx";
import {Card, CardContent, CardHeader} from "@/components/ui/card.tsx";
import {Avatar, AvatarFallback} from "@/components/ui/avatar.tsx";
import {Loader2} from "lucide-react";

export const KanbanBoardLoader = memo(function () {
  return (
    <div className="space-y-4 sm:space-y-6 animate-pulse">
      {/* Board Header Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Skeleton className="h-8 w-48 mb-2"/>
          <Skeleton className="h-4 w-80"/>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled>
            <Skeleton className="h-4 w-12"/>
          </Button>
          <Button size="sm" disabled>
            <Skeleton className="h-4 w-16"/>
          </Button>
        </div>
      </div>

      {/* Kanban Board Skeleton */}
      <div className="flex gap-3 sm:gap-6 min-h-[500px] sm:min-h-[600px] overflow-x-auto pb-4">
        {/* Column 1 - To Do */}
        <div className="flex flex-col min-w-[280px] sm:min-w-[300px] flex-shrink-0">
          {/* Column Header */}
          <div className="flex items-center justify-between mb-3 sm:mb-4 p-2 sm:p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-blue-400"/>
              <Skeleton className="h-4 w-12"/>
              <Badge variant="secondary" className="text-xs">
                <Skeleton className="h-3 w-3"/>
              </Badge>
            </div>
            <Skeleton className="h-5 w-5 sm:h-6 sm:w-6 rounded"/>
          </div>

          {/* Column Content */}
          <div
            className="flex-1 space-y-2 sm:space-y-3 min-h-[400px] sm:min-h-[500px] p-1 sm:p-2 rounded-lg border-2 border-dashed border-muted-foreground/25">
            {/* Task Cards */}
            {[1, 2, 3].map((i) => (
              <Card key={i} className="mb-2 sm:mb-3">
                <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-1 sm:gap-2">
                      <Skeleton className="w-4 h-4"/>
                      <Badge
                        variant="outline"
                        className="bg-red-100 text-red-800 border-red-200"
                      >
                        <Skeleton className="h-3 w-8"/>
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Skeleton className="h-5 w-5 sm:h-6 sm:w-6 rounded"/>
                      <Skeleton className="w-3 h-3 rounded"/>
                    </div>
                  </div>
                  <Skeleton className="h-4 w-full"/>
                  <Skeleton className="h-3 w-4/5"/>
                </CardHeader>
                <CardContent className="pt-0 px-3 sm:px-6 pb-3 sm:pb-6">
                  {/* Labels */}
                  <div className="flex flex-wrap gap-1 mb-2 sm:mb-3">
                    <Badge
                      variant="secondary"
                      className="bg-blue-100 text-blue-800"
                    >
                      <Skeleton className="h-3 w-12"/>
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="bg-green-100 text-green-800"
                    >
                      <Skeleton className="h-3 w-10"/>
                    </Badge>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="flex items-center gap-1">
                        <Skeleton className="w-3 h-3"/>
                        <Skeleton className="h-3 w-8"/>
                      </div>
                    </div>
                    <div className="flex -space-x-1">
                      <Avatar className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-background">
                        <AvatarFallback>
                          <Skeleton className="h-2 w-2"/>
                        </AvatarFallback>
                      </Avatar>
                      <Avatar className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-background">
                        <AvatarFallback>
                          <Skeleton className="h-2 w-2"/>
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Add task button */}
            <Button
              variant="ghost"
              className="w-full h-10 sm:h-12 border-2 border-dashed border-muted-foreground/25 transition-colors text-xs sm:text-sm"
              disabled
            >
              <Skeleton className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2"/>
              <Skeleton className="h-3 w-12"/>
            </Button>
          </div>
        </div>

        {/* Column 2 - In Progress */}
        <div className="flex flex-col min-w-[280px] sm:min-w-[300px] flex-shrink-0">
          {/* Column Header */}
          <div className="flex items-center justify-between mb-3 sm:mb-4 p-2 sm:p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-yellow-400"/>
              <Skeleton className="h-4 w-20"/>
              <Badge variant="secondary" className="text-xs">
                <Skeleton className="h-3 w-3"/>
              </Badge>
            </div>
            <Skeleton className="h-5 w-5 sm:h-6 sm:w-6 rounded"/>
          </div>

          {/* Column Content */}
          <div
            className="flex-1 space-y-2 sm:space-y-3 min-h-[400px] sm:min-h-[500px] p-1 sm:p-2 rounded-lg border-2 border-dashed border-muted-foreground/25">
            {/* Task Cards */}
            {[1, 2].map((i) => (
              <Card key={i} className="mb-2 sm:mb-3">
                <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-1 sm:gap-2">
                      <Skeleton className="w-4 h-4"/>
                      <Badge
                        variant="outline"
                        className="bg-orange-100 text-orange-800 border-orange-200"
                      >
                        <Skeleton className="h-3 w-10"/>
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Skeleton className="h-5 w-5 sm:h-6 sm:w-6 rounded"/>
                      <Skeleton className="w-3 h-3 rounded"/>
                    </div>
                  </div>
                  <Skeleton className="h-4 w-full"/>
                  <Skeleton className="h-3 w-3/4"/>
                </CardHeader>
                <CardContent className="pt-0 px-3 sm:px-6 pb-3 sm:pb-6">
                  {/* Labels */}
                  <div className="flex flex-wrap gap-1 mb-2 sm:mb-3">
                    <Badge
                      variant="secondary"
                      className="bg-purple-100 text-purple-800"
                    >
                      <Skeleton className="h-3 w-14"/>
                    </Badge>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="flex items-center gap-1">
                        <Skeleton className="w-3 h-3"/>
                        <Skeleton className="h-3 w-10"/>
                      </div>
                    </div>
                    <div className="flex -space-x-1">
                      <Avatar className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-background">
                        <AvatarFallback>
                          <Skeleton className="h-2 w-2"/>
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Add task button */}
            <Button
              variant="ghost"
              className="w-full h-10 sm:h-12 border-2 border-dashed border-muted-foreground/25 transition-colors text-xs sm:text-sm"
              disabled
            >
              <Skeleton className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2"/>
              <Skeleton className="h-3 w-12"/>
            </Button>
          </div>
        </div>

        {/* Column 3 - Review */}
        <div className="flex flex-col min-w-[280px] sm:min-w-[300px] flex-shrink-0">
          {/* Column Header */}
          <div className="flex items-center justify-between mb-3 sm:mb-4 p-2 sm:p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-amber-400"/>
              <Skeleton className="h-4 w-14"/>
              <Badge variant="secondary" className="text-xs">
                <Skeleton className="h-3 w-3"/>
              </Badge>
            </div>
            <Skeleton className="h-5 w-5 sm:h-6 sm:w-6 rounded"/>
          </div>

          {/* Column Content */}
          <div
            className="flex-1 space-y-2 sm:space-y-3 min-h-[400px] sm:min-h-[500px] p-1 sm:p-2 rounded-lg border-2 border-dashed border-muted-foreground/25">
            {/* Task Card */}
            <Card className="mb-2 sm:mb-3">
              <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <Skeleton className="w-4 h-4"/>
                    <Badge
                      variant="outline"
                      className="bg-yellow-100 text-yellow-800 border-yellow-200"
                    >
                      <Skeleton className="h-3 w-12"/>
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Skeleton className="h-5 w-5 sm:h-6 sm:w-6 rounded"/>
                    <Skeleton className="w-3 h-3 rounded"/>
                  </div>
                </div>
                <Skeleton className="h-4 w-full"/>
                <Skeleton className="h-3 w-2/3"/>
              </CardHeader>
              <CardContent className="pt-0 px-3 sm:px-6 pb-3 sm:pb-6">
                {/* Labels */}
                <div className="flex flex-wrap gap-1 mb-2 sm:mb-3">
                  <Badge
                    variant="secondary"
                    className="bg-pink-100 text-pink-800"
                  >
                    <Skeleton className="h-3 w-10"/>
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="bg-indigo-100 text-indigo-800"
                  >
                    <Skeleton className="h-3 w-12"/>
                  </Badge>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex items-center gap-1">
                      <Skeleton className="w-3 h-3"/>
                      <Skeleton className="h-3 w-8"/>
                    </div>
                  </div>
                  <div className="flex -space-x-1">
                    <Avatar className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-background">
                      <AvatarFallback>
                        <Skeleton className="h-2 w-2"/>
                      </AvatarFallback>
                    </Avatar>
                    <Avatar className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-background">
                      <AvatarFallback>
                        <Skeleton className="h-2 w-2"/>
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Add task button */}
            <Button
              variant="ghost"
              className="w-full h-10 sm:h-12 border-2 border-dashed border-muted-foreground/25 transition-colors text-xs sm:text-sm"
              disabled
            >
              <Skeleton className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2"/>
              <Skeleton className="h-3 w-12"/>
            </Button>
          </div>
        </div>

        {/* Column 4 - Done */}
        <div className="flex flex-col min-w-[280px] sm:min-w-[300px] flex-shrink-0">
          {/* Column Header */}
          <div className="flex items-center justify-between mb-3 sm:mb-4 p-2 sm:p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-green-400"/>
              <Skeleton className="h-4 w-10"/>
              <Badge variant="secondary" className="text-xs">
                <Skeleton className="h-3 w-3"/>
              </Badge>
            </div>
            <Skeleton className="h-5 w-5 sm:h-6 sm:w-6 rounded"/>
          </div>

          {/* Column Content */}
          <div
            className="flex-1 space-y-2 sm:space-y-3 min-h-[400px] sm:min-h-[500px] p-1 sm:p-2 rounded-lg border-2 border-dashed border-muted-foreground/25">
            {/* Task Card */}
            <Card className="mb-2 sm:mb-3 opacity-75">
              <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <Skeleton className="w-4 h-4"/>
                    <Badge
                      variant="outline"
                      className="bg-green-100 text-green-800 border-green-200"
                    >
                      <Skeleton className="h-3 w-6"/>
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Skeleton className="h-5 w-5 sm:h-6 sm:w-6 rounded"/>
                    <Skeleton className="w-3 h-3 rounded"/>
                  </div>
                </div>
                <Skeleton className="h-4 w-5/6"/>
                <Skeleton className="h-3 w-2/3"/>
              </CardHeader>
              <CardContent className="pt-0 px-3 sm:px-6 pb-3 sm:pb-6">
                {/* Labels */}
                <div className="flex flex-wrap gap-1 mb-2 sm:mb-3">
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-800"
                  >
                    <Skeleton className="h-3 w-14"/>
                  </Badge>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex items-center gap-1">
                      <Skeleton className="w-3 h-3"/>
                      <Skeleton className="h-3 w-6"/>
                    </div>
                  </div>
                  <div className="flex -space-x-1">
                    <Avatar className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-background">
                      <AvatarFallback>
                        <Skeleton className="h-2 w-2"/>
                      </AvatarFallback>
                    </Avatar>
                    <Avatar className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-background">
                      <AvatarFallback>
                        <Skeleton className="h-2 w-2"/>
                      </AvatarFallback>
                    </Avatar>
                    <Avatar className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-background">
                      <AvatarFallback>
                        <Skeleton className="h-2 w-2"/>
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Add task button */}
            <Button
              variant="ghost"
              className="w-full h-10 sm:h-12 border-2 border-dashed border-muted-foreground/25 transition-colors text-xs sm:text-sm"
              disabled
            >
              <Skeleton className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2"/>
              <Skeleton className="h-3 w-12"/>
            </Button>
          </div>
        </div>

        {/* Add Column Button Skeleton */}
        <div className="flex flex-col min-w-[280px] sm:min-w-[300px] flex-shrink-0">
          <div className="flex items-center justify-center mb-3 sm:mb-4 p-2 sm:p-3">
            <Skeleton className="h-4 w-20"/>
          </div>
          <Button
            variant="outline"
            className="flex-1 min-h-[400px] sm:min-h-[500px] border-2 border-dashed transition-colors text-xs sm:text-sm"
            disabled
          >
            <Skeleton className="w-5 h-5 sm:w-6 sm:h-6 mr-1 sm:mr-2"/>
            <Skeleton className="h-4 w-16"/>
          </Button>
        </div>
      </div>

      {/* Loading indicator overlay */}
      <div className="fixed bottom-6 right-6">
        <Card>
          <CardContent className="flex items-center gap-3 p-3">
            <Loader2 className="size-4 animate-spin text-primary"/>
            <span className="text-sm text-muted-foreground">
                Loading board...
              </span>
          </CardContent>
        </Card>
      </div>
    </div>
  );
})
