import {Check, Loader2, UserPlus} from "lucide-react";
import {memo} from "react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import z from "zod";
import {Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,} from "@/components/ui/form";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {useApiFetch} from "@/hooks/use-api-fetch";
import type {FormErrors, Project} from "@/types";
import {toast} from "sonner";
import {setFormErrors} from "@/lib/forms";

const schema = z.object({
  email: z.string().email("This email is not a valid email address"),
});

export const InviteMemberTab = memo(({id}: Pick<Project, "id">) => {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
    },
  });

  const {pending: sendingInvite, action: sendInvite} = useApiFetch<
    null,
    FormErrors | { message: string },
    z.infer<typeof schema>
  >({
    url: `/api/projects/${id}/invite`,
    options: {
      onSuccess() {
        toast.success("An invitation has been sent to the email address.");
      },
      onError(err) {
        const error = err.response.data;

        if ("message" in error) {
          toast.error(error.message);
        } else {
          setFormErrors(form, error);
        }
      },
    },
    deps: [id],
  });

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(async (data) => sendInvite({data}))}
          className="space-y-4"
        >
          <FormField
            control={form.control}
            name="email"
            render={({field}) => (
              <FormItem>
                <FormLabel>Email Address</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormDescription>
                  The email address of the person you want to invite to the
                  project.
                </FormDescription>
                <FormMessage/>
              </FormItem>
            )}
          />

          <Button className="w-full">
            {sendingInvite ? (
              <>
                <Loader2 className="animate-spin size-4"/>
                Inviting...
              </>
            ) : (
              <>

                <UserPlus className="size-4"/>
                Invite
              </>
            )}
          </Button>
        </form>
      </Form>

      <div className="p-4 bg-muted/50 rounded-lg space-y-2">
        <div className="flex items-start gap-2">
          <Check className="size-4 text-green-600 mt-0.5 flex-shrink-0"/>
          <div className="text-sm">
            <p className="font-medium text-green-700 dark:text-green-400">
              What happens when you invite someone?
            </p>
            <ul className="mt-1 text-muted-foreground space-y-1">
              <li>• They'll receive an email invitation</li>
              <li>• They can view and edit project tasks</li>
              <li>• They can collaborate with other members</li>
            </ul>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Only project creators can invite new members. Invited users will have
        full access to view and collaborate on all project tasks and content.
      </p>
    </div>
  );
});
