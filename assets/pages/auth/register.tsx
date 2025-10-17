import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function Register() {
  return (
    <>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create an Account</CardTitle>
          <CardDescription>
            Join our community and start managing your tasks today!
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <SocialLinks />
          <Divider>or</Divider>
        </CardContent>
      </Card>
    </>
  );
}
