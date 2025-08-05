export function AIAssistantPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Assistant</h1>
        <p className="text-muted-foreground">
          Get intelligent help with your tasks and projects using AI.
        </p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold">Smart Task Suggestions</h3>
              <p className="text-sm text-muted-foreground">AI-powered task recommendations</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="p-3 bg-orange-50 rounded-lg border">
              <p className="text-sm font-medium">Suggested Task</p>
              <p className="text-sm text-muted-foreground">Review and update project timelines based on recent progress</p>
              <button className="mt-2 text-xs bg-orange-600 text-white px-3 py-1 rounded">
                Add Task
              </button>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg border">
              <p className="text-sm font-medium">Suggested Task</p>
              <p className="text-sm text-muted-foreground">Schedule team sync meeting for next week</p>
              <button className="mt-2 text-xs bg-blue-600 text-white px-3 py-1 rounded">
                Add Task
              </button>
            </div>
          </div>
        </div>
        
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold">Quick Actions</h3>
              <p className="text-sm text-muted-foreground">AI-powered shortcuts</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="p-3 border rounded-lg text-sm hover:bg-muted">
              📊 Generate Report
            </button>
            <button className="p-3 border rounded-lg text-sm hover:bg-muted">
              📅 Schedule Meeting
            </button>
            <button className="p-3 border rounded-lg text-sm hover:bg-muted">
              ✉️ Draft Email
            </button>
            <button className="p-3 border rounded-lg text-sm hover:bg-muted">
              📋 Create Template
            </button>
          </div>
        </div>
      </div>
      
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">AI Chat Assistant</h3>
          <div className="h-96 border rounded-lg p-4 bg-muted/10 flex flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  AI
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm max-w-md">
                  <p className="text-sm">Hello! I'm your AI assistant. How can I help you with your tasks and projects today?</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3 justify-end">
                <div className="bg-orange-600 text-white p-3 rounded-lg shadow-sm max-w-md">
                  <p className="text-sm">Can you help me prioritize my tasks for this week?</p>
                </div>
                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-gray-600 text-sm font-medium">
                  You
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  AI
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm max-w-md">
                  <p className="text-sm">Of course! Based on your current projects and deadlines, I recommend focusing on:</p>
                  <ul className="mt-2 text-sm space-y-1">
                    <li>• Review design mockups (due today)</li>
                    <li>• Mobile app testing (due Friday)</li>
                    <li>• Team standup preparation</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="mt-4 flex space-x-2">
              <input 
                type="text" 
                placeholder="Type your message..." 
                className="flex-1 px-3 py-2 border rounded-lg text-sm"
              />
              <button className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm">
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
