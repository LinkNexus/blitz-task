import { useEffect, useState } from "react";
import { Switch, Redirect, Route, useLocation } from "wouter";
import { Login } from "./pages/auth/login";
import { Toaster } from "./components/ui/sonner";
import { Register } from "./pages/auth/register";
import { ForgotPassword } from "./pages/auth/forgot-password";
import { ResetPassword } from "./pages/auth/reset-password";
import { ThemeProvider } from "./providers/theme-provider";
import { useAuth } from "./providers/auth-provider";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "./components/ui/sidebar";
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
            <SidebarInset>
              <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
                <div className="flex items-center gap-2 px-4">
                  <SidebarTrigger className="-ml-1" />
                </div>
              </header>
              <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                <Switch>
                  <Route
                    component={() => {
                      const path = lastRequestedPath;
                      setLastRequestedPath(null);

                      return <Redirect to={path ?? "/"} />;
                    }}
                  />
                </Switch>
              </div>
            </SidebarInset>
          </SidebarProvider>
        )}
        {status === "unauthenticated" && (
          <div className="grid min-h-svh lg:grid-cols-2">
            <div className="flex flex-col gap-4 p-6 md:p-10">
              <div className="flex justify-center gap-2 md:justify-start">
                <a href="#" className="flex items-center gap-2 font-medium">
                  <img src="/logo.svg" alt="logo" className="w-10 h-10" />
                  Blitz-Task
                </a>
              </div>

              <div className="flex flex-1 items-center justify-center">
                <div className="w-full max-w-xs">
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
            </div>
            <div className="bg-muted relative hidden lg:block">
              <img
                src="/auth-wallpaper.jpg"
                alt="Image"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          </div>
        )}
      </div>

      <Toaster />
    </ThemeProvider>
  );
}
