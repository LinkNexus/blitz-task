import {AppSidebar} from "@/components/custom/sidebar/app-sidebar.tsx";
import {ThemeProvider} from "@/components/custom/theme-provider.tsx";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb.tsx";
import {Separator} from "@/components/ui/separator.tsx";
import {SidebarInset, SidebarProvider, SidebarTrigger} from "@/components/ui/sidebar.tsx";
import {Toaster} from "@/components/ui/sonner.tsx";
import {useAuth} from "@/hooks/useAuth.ts";
import {useAppStore} from "@/lib/store.ts";
import {AIAssistantPage} from "@/pages/ai-assistant-page.tsx";
import {ForgotPasswordPage} from "@/pages/auth/forgot-password-page.tsx";
import {LoginPage} from "@/pages/auth/login-page.tsx";
import {RegisterPage} from "@/pages/auth/register-page.tsx";
import {ResetPasswordPage} from "@/pages/auth/reset-password-page.tsx";
import {DashboardPage} from "@/pages/dashboard-page.tsx";
import {InboxPage} from "@/pages/inbox-page.tsx";
import {IssuesBoardPage} from "@/pages/issues-board/issues-board-page.tsx";
import {ProjectsPage} from "@/pages/projects-page.tsx";
import {useEffect} from "react";
import {Link, Redirect, Route, Switch, useLocation} from "wouter";
import {useParamsNavigation} from "@/hooks/useParamsNavigation.ts";
import {LoadingPage} from "@/components/custom/loading-page.tsx";
import {apiFetch} from "@/lib/fetch.ts";
import type {Project, Team} from "@/types.ts";
import {toast} from "sonner";

export function App() {
  const {user, status, authenticate, lastRequestedUrl, setLastRequestedUrl} = useAuth();
  const [location] = useLocation();

  const {
    sidebarState,
    toggleSidebar,
    setTeams,
    teams,
    setProjects
  } = useAppStore(state => state);

  // Function to get page title from current location
  const getPageTitle = () => {
    switch (location) {
      case '/dashboard':
        return 'Dashboard';
      case '/inbox':
        return 'Inbox';
      case '/issues-board':
        return 'Kanban Board';
      case '/projects':
        return 'Projects';
      case '/ai-chat':
        return 'AI Assistant';
      default:
        return 'Dashboard';
    }
  };

  useEffect(() => {
    authenticate();
  }, []);

  const {activeTeamId} = useParamsNavigation();
  const activeTeam = teams.find(team => team.id === activeTeamId);

  useEffect(() => {
    if (teams.length === 0 && user?.id) {
      apiFetch<Team[]>("/api/teams")
        .then((data: Team[]) => {
          setTeams(data);
        })
        .catch((error) => {
          toast.error("An error occurred while fetching teams.");
          console.error("Error fetching teams:", error);
        });
    }
  }, [teams.length, user?.id]);

  useEffect(() => {
    if (activeTeam && !activeTeam.projects) {
      apiFetch<Project[]>(`/api/projects?teamId=${activeTeam.id}`)
        .then(projects => {
          setProjects(activeTeam.id, projects);
        })
        .catch(error => {
          toast.error("An error occurred while fetching projects.");
          console.error("Error fetching projects:", error);
        });
    }
  }, [activeTeam?.id, activeTeam?.projects]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {(status === "unknown" || (status === "authenticated" && !activeTeam)) && <LoadingPage/>}

      {status === "authenticated" && (
        <ThemeProvider>
          <SidebarProvider
            open={sidebarState === "open"}
            onOpenChange={toggleSidebar}
          >
            <AppSidebar/>
            <SidebarInset>
              <header
                className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
                <div className="flex items-center gap-2 px-4">
                  <SidebarTrigger className="-ml-1"/>
                  <Separator orientation="vertical" className="mr-2 h-4"/>
                  <Breadcrumb>
                    <BreadcrumbList>
                      <BreadcrumbItem className="hidden md:block">
                        <BreadcrumbLink asChild>
                          <Link to="/dashboard">
                            Blitz-Task
                          </Link>
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator className="hidden md:block"/>
                      <BreadcrumbItem>
                        <BreadcrumbPage>{getPageTitle()}</BreadcrumbPage>
                      </BreadcrumbItem>
                    </BreadcrumbList>
                  </Breadcrumb>
                </div>
              </header>
              <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                <Switch>
                  <Route path="/dashboard" component={DashboardPage}/>
                  <Route path="/inbox" component={InboxPage}/>
                  <Route path="/issues-board" component={IssuesBoardPage}/>
                  <Route path="/projects" component={ProjectsPage}/>
                  <Route path="/ai-chat" component={AIAssistantPage}/>
                  <Route component={() => <Redirect to={lastRequestedUrl || "/dashboard"}/>}/>
                </Switch>
              </div>
            </SidebarInset>
          </SidebarProvider>
        </ThemeProvider>
      )}
      {status === "not-authenticated" && (
        <div
          className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-center mb-8">
              <div className="flex items-center space-x-2">
                <img src="/logo.svg" alt="logo" className="w-16 h-16"/>
                <span className="text-2xl font-bold">Blitz-Task</span>
              </div>
            </div>
            <Switch>
              <Route path="/login" component={LoginPage}/>
              <Route path="/register" component={RegisterPage}/>
              <Route path="/forgot-password" component={ForgotPasswordPage}/>
              <Route path="/reset-password" component={ResetPasswordPage}/>
              <Route component={() => {
                setLastRequestedUrl(location);
                return <Redirect to="/login"/>
              }}
              />
            </Switch>
          </div>
        </div>
      )}

      <Toaster/>
    </div>
  )
}
