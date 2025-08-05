export function MyTasksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Tasks</h1>
        <p className="text-muted-foreground">
          Manage your personal tasks and track your progress.
        </p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Today</h3>
            <span className="text-2xl font-bold text-orange-600">5</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Tasks due today
          </p>
        </div>
        
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">This Week</h3>
            <span className="text-2xl font-bold text-blue-600">12</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Tasks due this week
          </p>
        </div>
        
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Completed</h3>
            <span className="text-2xl font-bold text-green-600">28</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Tasks completed this month
          </p>
        </div>
        
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Overdue</h3>
            <span className="text-2xl font-bold text-red-600">3</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Tasks past due date
          </p>
        </div>
      </div>
      
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="p-6">
          <h3 className="text-lg font-semibold">Recent Tasks</h3>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h4 className="font-medium">Review design mockups</h4>
                <p className="text-sm text-muted-foreground">Due today at 3:00 PM</p>
              </div>
              <div className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs">
                High Priority
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h4 className="font-medium">Update project documentation</h4>
                <p className="text-sm text-muted-foreground">Due tomorrow</p>
              </div>
              <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                Medium Priority
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h4 className="font-medium">Team standup meeting</h4>
                <p className="text-sm text-muted-foreground">Due in 2 days</p>
              </div>
              <div className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                Low Priority
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
