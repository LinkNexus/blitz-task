import {
	memo,
	useEffect,
	useState,
	type Dispatch,
	type SetStateAction,
} from "react";
import { ProjectMembersTab } from "./project-members-tab";
import { InviteMemberTab } from "./invite-member-tab";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Users, UserPlus, Mail } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Project } from "@/types";
import type { ProjectForm } from "@/schemas";
import { PendingInvitesTab } from "./pending-invites-tab";
import type { UseProjectReturn } from "@/hooks/use-project";
import { useAccount } from "@/hooks/use-account";

export type ProjectMembersModalProps = {
	project: Project;
	setProject: UseProjectReturn["setProject"];
};

export const ProjectMembersModal = memo(
	({ project, setProject }: ProjectMembersModalProps) => {
		const [open, setOpen] = useState(false);
		const { user } = useAccount();

		useEffect(() => {
			document.addEventListener("project.participants-modal-open", () =>
				setOpen(true),
			);
		}, []);

		return (
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Users className="size-5" />
							Participants
						</DialogTitle>
						<DialogDescription>
							View and manage all project participants here
						</DialogDescription>
					</DialogHeader>

					{user.id !== project.createdBy.id ? (
						<ProjectMembersTab {...{ project, setProject }} />
					) : (
						<Tabs defaultValue="members" className="mt-4">
							<TabsList className="w-full">
								<TabsTrigger value="members" className="flex-1">
									<span className="flex items-center gap-1.5">
										<Users className="size-4" />
										<span className="hidden md:inline">Members</span>(
										{project.participants.length})
									</span>
								</TabsTrigger>
								<TabsTrigger value="invite" className="flex-1">
									<span className="flex items-center gap-1.5">
										<UserPlus className="size-4" />
										<span className="hidden md:inline">Invite</span>
									</span>
								</TabsTrigger>
								<TabsTrigger value="invites" className="flex-1">
									<span className="flex items-center gap-1.5">
										<Mail className="size-4" />
										<span className="hidden md:inline">Invites</span>
									</span>
								</TabsTrigger>
							</TabsList>

							<TabsContent value="members" className="mt-4">
								<ProjectMembersTab {...{ project, setProject }} />
							</TabsContent>

							<TabsContent value="invite" className="mt-4">
								<InviteMemberTab id={project.id} />
							</TabsContent>

							<TabsContent value="invites">
								<PendingInvitesTab id={project.id} />
							</TabsContent>
						</Tabs>
					)}
				</DialogContent>
			</Dialog>
		);
	},
);
