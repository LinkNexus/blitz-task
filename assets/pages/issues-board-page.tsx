export function IssuesBoardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kanban Board</h1>
          <p className="text-muted-foreground">
            Manage tasks across different stages of completion.
          </p>
        </div>
        <button className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg">
          + Add Task
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {/* To Do Column */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-700">To Do</h3>
            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">5</span>
          </div>
          <div className="space-y-3">
            <div className="bg-white p-4 rounded-lg border shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs">High</span>
                <span className="text-xs text-gray-500">Due: Today</span>
              </div>
              <h4 className="font-medium mb-2">Review design mockups</h4>
              <p className="text-sm text-gray-600 mb-3">Review the latest UI mockups and provide feedback</p>
              <div className="flex items-center justify-between">
                <div className="flex -space-x-2">
                  <div className="w-6 h-6 bg-blue-500 rounded-full border-2 border-white"></div>
                  <div className="w-6 h-6 bg-green-500 rounded-full border-2 border-white"></div>
                </div>
                <span className="text-xs text-gray-500">2 comments</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs">Medium</span>
                <span className="text-xs text-gray-500">Due: Tomorrow</span>
              </div>
              <h4 className="font-medium mb-2">Update project documentation</h4>
              <p className="text-sm text-gray-600 mb-3">Update the README and API documentation</p>
              <div className="flex items-center justify-between">
                <div className="flex -space-x-2">
                  <div className="w-6 h-6 bg-purple-500 rounded-full border-2 border-white"></div>
                </div>
                <span className="text-xs text-gray-500">1 comment</span>
              </div>
            </div>
          </div>
        </div>

        {/* In Progress Column */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-blue-700">In Progress</h3>
            <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded-full text-xs">3</span>
          </div>
          <div className="space-y-3">
            <div className="bg-white p-4 rounded-lg border shadow-sm border-l-4 border-l-blue-500">
              <div className="flex items-center justify-between mb-2">
                <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs">High</span>
                <span className="text-xs text-gray-500">Due: Friday</span>
              </div>
              <h4 className="font-medium mb-2">Mobile app testing</h4>
              <p className="text-sm text-gray-600 mb-3">Test the mobile app on different devices</p>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                <div className="bg-blue-600 h-2 rounded-full" style={{width: '60%'}}></div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex -space-x-2">
                  <div className="w-6 h-6 bg-red-500 rounded-full border-2 border-white"></div>
                  <div className="w-6 h-6 bg-yellow-500 rounded-full border-2 border-white"></div>
                </div>
                <span className="text-xs text-gray-500">60% complete</span>
              </div>
            </div>
          </div>
        </div>

        {/* Review Column */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-yellow-700">Review</h3>
            <span className="bg-yellow-100 text-yellow-600 px-2 py-1 rounded-full text-xs">2</span>
          </div>
          <div className="space-y-3">
            <div className="bg-white p-4 rounded-lg border shadow-sm border-l-4 border-l-yellow-500">
              <div className="flex items-center justify-between mb-2">
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">Low</span>
                <span className="text-xs text-gray-500">Due: Next week</span>
              </div>
              <h4 className="font-medium mb-2">API integration</h4>
              <p className="text-sm text-gray-600 mb-3">Integrate third-party APIs into the system</p>
              <div className="flex items-center justify-between">
                <div className="flex -space-x-2">
                  <div className="w-6 h-6 bg-indigo-500 rounded-full border-2 border-white"></div>
                </div>
                <span className="text-xs text-gray-500">Pending review</span>
              </div>
            </div>
          </div>
        </div>

        {/* Done Column */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-green-700">Done</h3>
            <span className="bg-green-100 text-green-600 px-2 py-1 rounded-full text-xs">8</span>
          </div>
          <div className="space-y-3">
            <div className="bg-white p-4 rounded-lg border shadow-sm border-l-4 border-l-green-500 opacity-75">
              <h4 className="font-medium mb-2">Database schema design</h4>
              <p className="text-sm text-gray-600 mb-3">Design and implement the database schema</p>
              <div className="flex items-center justify-between">
                <div className="flex -space-x-2">
                  <div className="w-6 h-6 bg-pink-500 rounded-full border-2 border-white"></div>
                  <div className="w-6 h-6 bg-cyan-500 rounded-full border-2 border-white"></div>
                </div>
                <span className="text-xs text-green-600">✓ Completed</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border shadow-sm border-l-4 border-l-green-500 opacity-75">
              <h4 className="font-medium mb-2">User authentication setup</h4>
              <p className="text-sm text-gray-600 mb-3">Set up OAuth and user authentication</p>
              <div className="flex items-center justify-between">
                <div className="flex -space-x-2">
                  <div className="w-6 h-6 bg-orange-500 rounded-full border-2 border-white"></div>
                </div>
                <span className="text-xs text-green-600">✓ Completed</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
