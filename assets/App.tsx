import { memo, useEffect } from "react";
import { Redirect, Route, Switch } from "wouter";
import { ProjectModal } from "./components/custom/projects/project-modal";
import { AppSidebar } from "./components/custom/sidebar/app-sidebar";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "./components/ui/sidebar";
import { Toaster } from "./components/ui/sonner";
import { useAuth } from "./hooks/use-auth";
import { useTheme } from "./hooks/use-theme";
import { ForgotPasswordPage } from "./pages/auth/forgot-password-page";
import { Login as LoginPage } from "./pages/auth/login-page";
import { RegistrationPage } from "./pages/auth/register-page";
import { ResetPasswordPage } from "./pages/auth/reset-password-page";
import { ProjectPage } from "./pages/projects/single-project-page";
import { ConfirmModal } from "./components/custom/confirm-action-modal";

export const App = memo(() => {
	const { status, authenticate } = useAuth();

	useEffect(authenticate, []);
	useTheme();

	return (
		<>
			<div className="min-h-screen bg-background text-foreground flex flex-col">
				{status === "authenticated" && (
					<>
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
										<Route path="/projects" nest>
											<Route path={/[/](?<id>(\d+))/} component={ProjectPage} />
										</Route>
										<Route component={() => <Redirect to="/" />} />
									</Switch>
								</div>
							</SidebarInset>
						</SidebarProvider>
						<ProjectModal />
					</>
				)}
				{status === "unauthenticated" && (
					<div className="grid min-h-svh lg:grid-cols-2">
						<div className="flex flex-col gap-4 p-6 md:p-10">
							<div className="flex justify-center gap-2 md:justify-start">
								<a
									href="/login"
									className="flex items-center gap-2 font-medium"
								>
									<img src="/logo.svg" alt="logo" className="w-10 h-10" />
									Blitz-Task
								</a>
							</div>

							<div className="flex flex-1 items-center justify-center">
								<div className="w-full max-w-xs">
									<Switch>
										<Route path="/login" component={LoginPage} />
										<Route path="/register" component={RegistrationPage} />
										<Route
											path="/forgot-password"
											component={ForgotPasswordPage}
										/>
										<Route
											path="/reset-password"
											component={ResetPasswordPage}
										/>
										<Route component={() => <Redirect to="/login" />} />
									</Switch>
								</div>
							</div>
						</div>
						<div className="bg-muted relative hidden lg:block">
							<img
								src="/auth-wallpaper.jpg"
								alt="Auth Wallpaper"
								className="absolute inset-0 h-full w-full object-cover"
							/>
						</div>
					</div>
				)}
			</div>

			<Toaster />
			<ConfirmModal />
		</>
	);
});
