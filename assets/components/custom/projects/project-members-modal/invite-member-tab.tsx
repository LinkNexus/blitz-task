import { Check, Mail, UserPlus } from "lucide-react";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const InviteMemberTab = memo(() => {
	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<label htmlFor="invite-email" className="text-sm font-medium">
					Email address
				</label>
				<div className="flex gap-2">
					<div className="relative flex-1">
						<Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
						<Input
							type="email"
							placeholder="colleague@example.com"
							className="pl-10"
						/>
					</div>
					<Button className="px-6">
						<UserPlus className="size-4" />
						Invite
					</Button>
				</div>
			</div>

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
