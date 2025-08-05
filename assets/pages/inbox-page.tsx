export function InboxPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Inbox</h1>
        <p className="text-muted-foreground">
          View and manage your notifications and messages.
        </p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Unread</h3>
            <span className="text-2xl font-bold text-orange-600">12</span>
          </div>
          <p className="text-xs text-muted-foreground">
            New notifications
          </p>
        </div>
        
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Task Updates</h3>
            <span className="text-2xl font-bold text-blue-600">8</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Recent task changes
          </p>
        </div>
        
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Mentions</h3>
            <span className="text-2xl font-bold text-green-600">3</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Times mentioned today
          </p>
        </div>
      </div>
      
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Notifications</h3>
          <div className="space-y-4">
            <div className="flex items-start space-x-4 p-4 border rounded-lg bg-orange-50 border-orange-200">
              <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
              <div className="flex-1">
                <h4 className="font-medium">New task assigned</h4>
                <p className="text-sm text-muted-foreground">You've been assigned to "Review design mockups" in Website Redesign project</p>
                <p className="text-xs text-muted-foreground mt-1">2 minutes ago</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4 p-4 border rounded-lg">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <div className="flex-1">
                <h4 className="font-medium">Task completed</h4>
                <p className="text-sm text-muted-foreground">Sarah Johnson completed "API integration" in Mobile App project</p>
                <p className="text-xs text-muted-foreground mt-1">1 hour ago</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4 p-4 border rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
              <div className="flex-1">
                <h4 className="font-medium">Mentioned in comment</h4>
                <p className="text-sm text-muted-foreground">Mike Chen mentioned you in a comment on "Update documentation"</p>
                <p className="text-xs text-muted-foreground mt-1">3 hours ago</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
