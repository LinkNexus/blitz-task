import { Crown, MoreHorizontal, UserMinus, Users } from "lucide-react";
import { memo } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAccount } from "@/hooks/use-account";
import { getInitials } from "@/lib/utils";
import type { ProjectMembersModalProps } from "./project-members-modal";
import { useApiFetch } from "@/hooks/use-api-fetch";
import { confirmAction } from "../../confirm-action-modal";
import { toast } from "sonner";

export const ProjectMembersTab = memo(
	({ project, setProject }: ProjectMembersModalProps) => {
		const { user } = useAccount();
		const { participants, createdBy } = project;

		const { pending: removing, action: removeMember } = useApiFetch<{
			memberId: number;
		}>({
			url: `/api/projects/${project.id}/remove-member`,
			options: {
				method: "POST",
				onSuccess(res) {
					setProject((prev) => {
						if (!prev) return prev;
						return {
							...prev,
							participants: prev.participants.filter(
								(participant) => participant.id !== res.data.memberId,
							),
						};
					});

					toast.success("Participant removed successfully.");
				},
			},
			deps: [project.id, setProject],
		});

		return (
			<ScrollArea className="max-h-72 overflow-y-auto">
				<div className="space-y-3">
					{participants.map((participant) => (
						<div
							key={participant.id}
							className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
						>
							<div className="flex items-center gap-3 flex-1">
								<Avatar className="size-10">
									<AvatarFallback className="text-sm font-medium">
										{getInitials(participant.name)}
									</AvatarFallback>
								</Avatar>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2 flex-wrap">
										<p className="font-medium text-sm truncate">
											{participant.name}
										</p>
										{participant.id === createdBy.id && (
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger asChild>
														<Crown className="size-4 text-amber-500 flex-shrink-0" />
													</TooltipTrigger>
													<TooltipContent>Project Creator</TooltipContent>
												</Tooltip>
											</TooltipProvider>
										)}
										{participant.id === user.id && (
											<Badge variant="secondary" className="text-xs">
												You
											</Badge>
										)}
									</div>
								</div>
							</div>

							{createdBy.id === user.id && participant.id !== user.id && (
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="ghost" size="icon-sm">
											<MoreHorizontal className="size-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem
											onClick={() => {
												confirmAction({
													async action() {
														await removeMember({
															searchParams: { memberId: participant.id },
														});
													},
													title: "Remove Participant",
													description: `Are you sure you want to remove ${participant.name} from this project? This action cannot be undone.`,
												});
											}}
											className="text-destructive focus:text-destructive"
										>
											<UserMinus className="size-4 text-destructive" />
											Remove
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							)}
						</div>
					))}

					{participants.length === 0 && (
						<div className="text-center py-8 text-muted-foreground">
							<Users className="size-12 mx-auto mb-3 opacity-50" />
							<p className="text-sm">No participants yet</p>
							<p className="text-xs">Invite team members to get started</p>
						</div>
					)}
				</div>
			</ScrollArea>
		);
	},
);
