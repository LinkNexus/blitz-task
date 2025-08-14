import {memo} from "react";

export const LoadingPage = memo(function () {
  return (
    <div
      className="flex items-center justify-center h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="flex flex-col items-center space-y-6">
        {/* Animated Logo */}
        <div className="relative">
          <div
            className="absolute inset-0 bg-primary rounded-full blur-xl opacity-20 animate-pulse"></div>
          <div
            className="relative bg-primary p-4 rounded-2xl shadow-lg">
            <img
              src="/logo.svg"
              alt="BlitzTask Logo"
              className="w-12 h-12 text-white animate-bounce"
            />
          </div>
        </div>

        {/* Brand Name */}
        <div className="text-center space-y-2">
          <h1
            className="text-2xl font-bold text-primary">
            Blitz-Task
          </h1>
          <p className="text-sm text-muted-foreground animate-pulse">
            Loading your workspace...
          </p>
        </div>

        {/* Enhanced Loading Spinner */}
        <div className="relative">
          {/* Outer ring */}
          <div
            className="w-12 h-12 border-4 border-muted rounded-full animate-spin border-t-transparent"></div>
          {/* Inner ring */}
          <div
            className="absolute inset-2 w-8 h-8 border-3 border-primary/30 rounded-full animate-spin border-b-transparent [animation-direction:reverse] [animation-duration:1.5s]"></div>
          {/* Center dot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
          </div>
        </div>

        {/* Progress Dots */}
        <div className="flex space-x-1">
          <div
            className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div
            className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
        </div>
      </div>
    </div>
  )
});
