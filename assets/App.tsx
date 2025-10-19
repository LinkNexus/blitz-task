import { useEffect, useState } from "react";
import { Switch, Redirect, Route, useLocation } from "wouter";
import { Login } from "./pages/auth/login";
import { Toaster } from "./components/ui/sonner";
import { Register } from "./pages/auth/register";
import { ForgotPassword } from "./pages/auth/forgot-password";
import { ResetPassword } from "./pages/auth/reset-password";
import { ThemeProvider } from "./providers/theme-provider";
import { useAuth } from "./providers/auth-provider";
import { SidebarProvider } from "./components/ui/sidebar";
import { AppSidebar } from "./components/custom/sidebar/app-sidebar";

export function App() {
  const { status, user, authenticate } = useAuth();
  const [lastRequestedPath, setLastRequestedPath] = useState<string | null>(
    null,
  );
  const [currentLocation] = useLocation();

  useEffect(authenticate, []);

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        {status === "authenticated" && (
          <SidebarProvider>
            <AppSidebar />
          </SidebarProvider>
        )}
        {status === "unauthenticated" && (
          <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md">
              {/* Header */}
              <div className="flex items-center justify-center mb-8">
                <div className="flex items-center space-x-2">
                  <img src="/logo.svg" alt="logo" className="w-16 h-16" />
                  <span className="text-2xl font-bold">Blitz-Task</span>
                </div>
              </div>
              <Switch>
                <Route path="/login" component={Login} />
                <Route path="/register" component={Register} />
                <Route path="/forgot-password" component={ForgotPassword} />
                <Route path="/reset-password" component={ResetPassword} />
                <Route
                  component={() => {
                    setLastRequestedPath(currentLocation);
                    return <Redirect to="/login" />;
                  }}
                />
              </Switch>
            </div>
          </div>
        )}
      </div>

      <Toaster />
    </ThemeProvider>
  );
}
