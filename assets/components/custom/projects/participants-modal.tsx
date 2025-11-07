import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { memo, useEffect, useState } from "react";
import {
	Crown,
	Mail,
	MoreHorizontal,
	UserMinus,
	Users,
	UserPlus,
	Check,
} from "lucide-react";
import { getInitials } from "@/lib/utils";
import { useAccount } from "@/hooks/use-account";
import { toast } from "sonner";
import type { Project, User } from "@/types";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ParticipantsModalProps {
	project?: Project;
}

export const ParticipantsModal = memo(({ project }: ParticipantsModalProps) => {
	const [open, setOpen] = useState(false);
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviting, setInviting] = useState(false);
	const [removing, setRemoving] = useState<number | null>(null);
	const { user: currentUser } = useAccount();

	useEffect(() => {
		document.addEventListener("project.participants-modal-open", () => {
			setOpen(true);
		});
	}, []);

	const handleInvite = async () => {
		if (!inviteEmail.trim() || !project) return;

		setInviting(true);

		// Mock API call - simulate network delay
		setTimeout(() => {
			const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

			if (!emailPattern.test(inviteEmail.trim())) {
				toast.error("Please enter a valid email address.");
				setInviting(false);
				return;
			}

			// Check if user already exists in project
			const existingParticipant = project.participants.find((p) =>
				p.name.toLowerCase().includes(inviteEmail.split("@")[0].toLowerCase()),
			);

			if (existingParticipant) {
				toast.error("User is already a participant in this project.");
			} else {
				toast.success("Invitation sent successfully! (Mock)");
				setInviteEmail("");
			}
			setInviting(false);
		}, 1000);
	};

	const handleRemove = async (userId: number) => {
		if (!project) return;

		setRemoving(userId);

		// Mock API call - simulate network delay
		setTimeout(() => {
			toast.success("Participant removed successfully! (Mock)");
			setRemoving(null);
		}, 800);
	};

	const isCreator = (participant: Pick<User, "id" | "name">) =>
		participant.id === project?.createdBy.id;

	const canRemoveParticipant = (participant: Pick<User, "id" | "name">) =>
		currentUser?.id === project?.createdBy.id &&
		participant.id !== currentUser.id;

	if (!project) return null;

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Users className="size-5" />
						Participants
					</DialogTitle>
					<DialogDescription>
						View and manage all project participants here
					</DialogDescription>
				</DialogHeader>

				<Tabs defaultValue="members" className="mt-4">
					<TabsList className="w-full">
						<TabsTrigger value="members" className="flex-1">
							<span className="flex items-center gap-1.5">
								<Users className="size-4" />
								Members ({project.participants.length})
							</span>
						</TabsTrigger>
						<TabsTrigger value="invite" className="flex-1">
							<span className="flex items-center gap-1.5">
								<UserPlus className="size-4" />
								Invite
							</span>
						</TabsTrigger>
					</TabsList>

					<TabsContent value="members" className="mt-4">
						<div className="max-h-30">
							<div className="space-y-3">
								{project.participants.map((participant) => (
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
													{isCreator(participant) && (
														<TooltipProvider>
															<Tooltip>
																<TooltipTrigger asChild>
																	<Crown className="size-4 text-amber-500 flex-shrink-0" />
																</TooltipTrigger>
																<TooltipContent>Project Creator</TooltipContent>
															</Tooltip>
														</TooltipProvider>
													)}
													{participant.id === currentUser?.id && (
														<Badge variant="secondary" className="text-xs">
															You
														</Badge>
													)}
												</div>
											</div>
										</div>

										{canRemoveParticipant(participant) && (
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button
														variant="ghost"
														size="icon-sm"
														disabled={removing === participant.id}
													>
														{removing === participant.id ? (
															<Spinner className="size-4" />
														) : (
															<MoreHorizontal className="size-4" />
														)}
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem
														onClick={() => handleRemove(participant.id)}
														className="text-destructive focus:text-destructive"
													>
														<UserMinus className="size-4" />
														Remove from project
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										)}
									</div>
								))}

								{project.participants.length === 0 && (
									<div className="text-center py-8 text-muted-foreground">
										<Users className="size-12 mx-auto mb-3 opacity-50" />
										<p className="text-sm">No participants yet</p>
										<p className="text-xs">
											Invite team members to get started
										</p>
									</div>
								)}
							</div>
						</div>
					</TabsContent>

					<TabsContent value="invite" className="mt-4">
						<div className="space-y-4">
							<div className="space-y-2">
								<label htmlFor="invite-email" className="text-sm font-medium">
									Email address
								</label>
								<div className="flex gap-2">
									<div className="relative flex-1">
										<Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
										<Input
											id="invite-email"
											type="email"
											placeholder="colleague@example.com"
											value={inviteEmail}
											onChange={(e) => setInviteEmail(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													e.preventDefault();
													handleInvite();
												}
											}}
											className="pl-10"
											disabled={inviting}
										/>
									</div>
									<Button
										onClick={handleInvite}
										disabled={!inviteEmail.trim() || inviting}
										className="px-6"
									>
										{inviting ? (
											<Spinner className="size-4" />
										) : (
											<>
												<UserPlus className="size-4" />
												Invite
											</>
										)}
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
								Only project creators can invite new members. Invited users will
								have full access to view and collaborate on all project tasks
								and content.
							</p>
						</div>
					</TabsContent>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
});
