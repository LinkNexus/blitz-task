import type { ReactNode } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

type Props = {
  title: string;
  description: string;
  children: ReactNode;
};

export function AuthPageStructure({ title, description, children }: Props) {
  return (
    <>
      <Card>
        <CardHeader className="text-center px-4 md:px-6">
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 px-4 md:px-6">
          {/* <SocialLinks /> */}
          {/* <Divider>or</Divider> */}
          {children}
        </CardContent>
      </Card>
    </>
  );
}
