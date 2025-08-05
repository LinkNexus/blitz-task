export function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">
            Manage your projects and collaborate with your team.
          </p>
        </div>
        <button className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg">
          + New Project
        </button>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Website Redesign</h3>
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                Active
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Complete redesign of the company website with modern UI/UX.
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>75%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-orange-600 h-2 rounded-full" style={{ width: '75%' }}></div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
              <span>6 team members</span>
              <span>Due: Dec 15</span>
            </div>
          </div>
        </div>
        
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Mobile App</h3>
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                In Review
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Cross-platform mobile application for task management.
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>90%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: '90%' }}></div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
              <span>4 team members</span>
              <span>Due: Dec 10</span>
            </div>
          </div>
        </div>
        
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Marketing Campaign</h3>
              <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs">
                Planning
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Q1 marketing campaign for product launch and user acquisition.
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>25%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-yellow-600 h-2 rounded-full" style={{ width: '25%' }}></div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
              <span>8 team members</span>
              <span>Due: Jan 30</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Project Activity</h3>
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm">
                  <span className="font-medium">Sarah Johnson</span> completed task "Design homepage mockup" in 
                  <span className="font-medium"> Website Redesign</span>
                </p>
                <p className="text-xs text-muted-foreground">2 hours ago</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm">
                  <span className="font-medium">Mike Chen</span> started working on "API integration" in 
                  <span className="font-medium"> Mobile App</span>
                </p>
                <p className="text-xs text-muted-foreground">4 hours ago</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm">
                  <span className="font-medium">Emily Davis</span> added 3 new tasks to 
                  <span className="font-medium"> Marketing Campaign</span>
                </p>
                <p className="text-xs text-muted-foreground">1 day ago</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
