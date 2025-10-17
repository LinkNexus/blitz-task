import type { ReactNode } from "react";
import { Divider } from "../divider";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { SocialLinks } from "./social-links";

type Props = {
  title: string;
  description: string;
  children: ReactNode;
};

export function AuthPageStructure({ title, description, children }: Props) {
  return (
    <>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <SocialLinks />
          <Divider>or</Divider>
          {children}
        </CardContent>
      </Card>
    </>
  );
}
