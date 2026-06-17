import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import wallpaper from "@/assets/wallpaper.jpg";
import { Card, CardContent } from "@/components/ui/card";
import { FieldDescription } from "@/components/ui/field";

export const Route = createFileRoute("/_auth")({
  beforeLoad: ({ context }) => {
    if (context.user) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AuthPagesLayout,
});

function AuthPagesLayout() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
        <div className="flex flex-col gap-6">
          <Card className="overflow-hidden p-0">
            <CardContent className="grid p-0 md:grid-cols-2">
              <div className="p-6 md:p-8">
                <Outlet />
              </div>
              <div className="bg-muted relative hidden md:block">
                <img
                  src={wallpaper}
                  alt="Wallpaper"
                  className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
                />
              </div>
            </CardContent>
          </Card>
          <FieldDescription className="px-6 text-center">
            By continuing, you agree to our <a href="#">Terms of Service</a> and{" "}
            <a href="#">Privacy Policy</a>.
          </FieldDescription>
        </div>
      </div>
    </div>
  );
}
