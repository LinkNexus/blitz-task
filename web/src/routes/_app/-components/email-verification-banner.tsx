import { IconAlertCircle } from "@tabler/icons-react";
import { toast } from "sonner";
import { resendConfirmEmail } from "@/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function EmailVerificationBanner() {
  return (
    <div className="flex flex-1 flex-col gap-4 mb-8">
      <Alert variant="destructive">
        <IconAlertCircle className="h-4 w-4" />
        <AlertTitle>Email verification required</AlertTitle>
        <AlertDescription>
          <span>
            You must verify your email address before using effectively the
            application. Check the verfication email we sent you when you signed
            up. If you can't find it, click{" "}
            <a
              href="#"
              className="font-bold underline underline-offset-2"
              onClick={async (e) => {
                e.preventDefault();
                const { data } = await resendConfirmEmail();

                if (data)
                  toast.success("Email confirmed", {
                    description:
                      "A new confirmation email has been sent to your email address",
                  });
              }}
            >
              here
            </a>{" "}
            to resend the verification email.
          </span>
        </AlertDescription>
      </Alert>
    </div>
  );
}
