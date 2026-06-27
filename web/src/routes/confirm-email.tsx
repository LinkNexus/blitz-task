import { createFileRoute, Navigate, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import z from "zod";
import { confirmEmail } from "@/api";
import { getCurrentUserOptions } from "@/api/@tanstack/react-query.gen";
import { tokenSchemaObject } from "@/lib/shared-models";
import { flashMessagesStore } from "@/lib/store";

const ConfirmEmailSchema = z.object(tokenSchemaObject);

export const Route = createFileRoute("/confirm-email")({
  validateSearch: ConfirmEmailSchema,
  errorComponent: () => {
    useEffect(() => {
      flashMessagesStore.actions.addSingle({
        type: "error",
        message: {
          title: "Invalid confirmation link",
          description:
            "The confirmation link you used was either invalid or malformed",
        },
      });
    }, []);

    return <Navigate to="/login" />;
  },
  async beforeLoad({ search: { userId, token }, context }) {
    const { error } = await confirmEmail({ body: { userId, token } });

    if (error) {
      if ("message" in error) {
        flashMessagesStore.actions.addSingle({
          type: "error",
          message: {
            title: "Email confirmation failed",
            description: error.message,
          },
        });

        throw redirect({
          to: "/login",
        });
      }
    } else {
      context.queryClient.invalidateQueries(getCurrentUserOptions());
      flashMessagesStore.actions.addSingle({
        type: "success",
        message: {
          title: "Email confirmed",
          description:
            "Your email address was successfully confirmed! You now have access to all features",
        },
      });
      throw redirect({
        to: "/dashboard",
      });
    }
  },
});
