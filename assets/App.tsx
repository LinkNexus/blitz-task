import {Redirect, Route, Switch} from "wouter";
import {LoginPage} from "@/pages/auth/login-page.tsx";
import {RegisterPage} from "@/pages/auth/register-page.tsx";
import {ForgotPasswordPage} from "@/pages/auth/forgot-password-page.tsx";
import {Toaster} from "@/components/ui/sonner.tsx";
import {ResetPasswordPage} from "@/pages/auth/reset-password-page.tsx";
import {DashboardPage} from "@/pages/dashboard-page.tsx";
import {useAuth} from "@/hooks/useAuth.ts";
import {useEffect} from "react";

export function App() {
    const {status, authenticate} = useAuth();

    useEffect(() => {
        if (status === "unknown") {
            authenticate();
        }
    }, []);

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            {status === "unknown" && (
                <div className="flex items-center justify-center h-screen bg-gradient-to-br from-background via-background to-muted/20">
                    <div className="flex flex-col items-center space-y-6">
                        {/* Animated Logo */}
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full blur-xl opacity-20 animate-pulse"></div>
                            <div className="relative bg-gradient-to-br from-orange-500 to-orange-600 p-4 rounded-2xl shadow-lg">
                                <img 
                                    src="/logo.svg" 
                                    alt="BlitzTask Logo" 
                                    className="w-12 h-12 text-white animate-bounce"
                                    style={{ filter: 'brightness(0) invert(1)' }}
                                />
                            </div>
                        </div>

                        {/* Brand Name */}
                        <div className="text-center space-y-2">
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-500 to-orange-600 bg-clip-text text-transparent">
                                Blitz-Task
                            </h1>
                            <p className="text-sm text-muted-foreground animate-pulse">
                                Loading your workspace...
                            </p>
                        </div>

                        {/* Enhanced Loading Spinner */}
                        <div className="relative">
                            {/* Outer ring */}
                            <div className="w-12 h-12 border-4 border-muted rounded-full animate-spin border-t-transparent"></div>
                            {/* Inner ring */}
                            <div className="absolute inset-2 w-8 h-8 border-3 border-orange-500/30 rounded-full animate-spin border-b-transparent [animation-direction:reverse] [animation-duration:1.5s]"></div>
                            {/* Center dot */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-2 h-2 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full animate-pulse"></div>
                            </div>
                        </div>

                        {/* Progress Dots */}
                        <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"></div>
                        </div>
                    </div>
                </div>
            )}

            {status === "authenticated" && (
                <Switch>
                    <Route path="/dashboard" component={DashboardPage}/>
                    <Route component={() => <Redirect to="/dashboard"/>}/>
                </Switch>
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
                            <Route component={() => <Redirect to="/login"/>}/>
                        </Switch>
                    </div>
                </div>
            )}

            <Toaster/>
        </div>
    )
}
