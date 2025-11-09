import { Check, Mail, UserPlus } from "lucide-react";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import z from "zod";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const schema = z.object({
	email: z.string().email("This email is not a valid email address"),
});

export const InviteMemberTab = memo(() => {
	const form = useForm({
		resolver: zodResolver(schema),
		defaultValues: {
			email: "",
		},
	});

	return (
		<div className="space-y-4">
			<Form {...form}>
				<form className="space-y-4">
					<FormField
						control={form.control}
						name="email"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Email Address</FormLabel>
								<FormControl>
									<Input {...field} />
								</FormControl>
								<FormDescription>
									The email address of the person you want to invite to the
									project.
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<Button className="w-full">
						<UserPlus className="size-4" />
						Invite
					</Button>
				</form>
			</Form>

			<div className="p-4 bg-muted/50 rounded-lg space-y-2">
				<div className="flex items-start gap-2">
					<Check className="size-4 text-green-600 mt-0.5 flex-shrink-0" />
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
