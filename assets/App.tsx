import {useAppStore} from "@/lib/store.ts";
import {Redirect, Route, Switch} from "wouter";
import {LoginPage} from "@/pages/auth/login-page.tsx";
import {RegisterPage} from "@/pages/auth/register-page.tsx";
import {ForgotPasswordPage} from "@/pages/auth/forgot-password-page.tsx";
import {Toaster} from "@/components/ui/sonner.tsx";
import {ResetPasswordPage} from "@/pages/auth/reset-password-page.tsx";

export function App() {
  const {user} = useAppStore(state => state);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {user ? (
        <div>Hello</div>
      ) : (
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
