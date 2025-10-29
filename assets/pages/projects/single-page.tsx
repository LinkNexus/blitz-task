import {
	Loader,
	Users,
	Calendar,
	Settings,
	MoreHorizontal,
	Plus,
	Filter,
	Search,
} from "lucide-react";
import { useEffect } from "react";
import { useParams } from "wouter";
import { useProject } from "@/hooks/use-project";
import { IconsPopover } from "@/components/custom/icons-popover";
import { EditableContent } from "@/components/custom/editable-content";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { getInitials } from "@/lib/utils";
import type { Project } from "@/types";
import { AvatarGroup } from "@/components/custom/avatar-group";

export function ProjectPage() {
	const { id } = useParams<{ id: string }>();
	const { gettingProject, getProject, project, updateProject } = useProject(
		Number(id),
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		getProject();
	}, []);

	if (gettingProject || !project) {
		return (
			<div className="flex flex-1 items-center justify-center">
				<Loader className="animate-spin size-10" />
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full max-h-screen overflow-hidden">
			{/* Project Header */}
			<div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
				<div className="flex flex-col gap-4 p-4 lg:p-6">
					{/* Main Project Info */}
					<div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
						<div className="flex items-center gap-4">
							<Avatar className="size-16 sm:size-20 ring-2 ring-border">
								<AvatarImage src={`/api/projects/image/${project.id}`} />
								<AvatarFallback className="font-bold text-primary text-2xl sm:text-4xl bg-primary/10">
									{getInitials(project.name)}
								</AvatarFallback>
							</Avatar>

							<div className="flex flex-col gap-2">
								<div className="flex items-center gap-2 sm:gap-3">
									<IconsPopover
										onEmojiSelect={(icon) => {
											updateProject({ data: { ...project, icon } });
										}}
									>
										<span className="text-2xl sm:text-4xl cursor-pointer hover:scale-110 transition-transform">
											{project.icon || "📋"}
										</span>
									</IconsPopover>
									<EditableContent
										value={project.name}
										onSave={(name) => {
											updateProject({ data: { ...project, name } });
										}}
									>
										<h1 className="font-black text-2xl sm:text-4xl text-foreground hover:text-primary transition-colors cursor-pointer">
											{project.name}
										</h1>
									</EditableContent>
								</div>
								{project.description && (
									<p className="text-muted-foreground text-sm sm:text-base max-w-md">
										{project.description}
									</p>
								)}
							</div>
						</div>

						{/* Project Actions */}
						<div className="flex items-center gap-2 ml-auto">
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="outline" size="sm">
										<MoreHorizontal className="size-4" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem>
										<Settings className="size-4" />
										Project Settings
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem className="text-destructive">
										Archive Project
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</div>

					<div>
						<div className="flex items-center gap-2">
							<div className="flex -space-x-2">
								{project.participants.slice(0, 5).map((participant) => (
									<TooltipProvider key={participant.id}>
										<Tooltip>
											<TooltipTrigger asChild>
												<Avatar className="size-8 ring-2 ring-background border hover:scale-110 transition-transform cursor-pointer">
													<AvatarFallback className="text-xs bg-primary/10 text-primary">
														{getInitials(participant.name)}
													</AvatarFallback>
												</Avatar>
											</TooltipTrigger>
											<TooltipContent>{participant.name}</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								))}
								{project.participants.length > 5 && (
									<div className="size-8 rounded-full bg-muted border-2 border-background flex items-center justify-center">
										<span className="text-xs text-muted-foreground font-medium">
											+{project.participants.length - 5}
										</span>
									</div>
								)}
							</div>
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="sm"
											className="size-8 rounded-full"
										>
											<Users className="size-4" />
										</Button>
									</TooltipTrigger>
									<TooltipContent>View all participants</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						</div>
					</div>

					{/* Project Meta & Team */}
					<div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
						<div className="flex flex-wrap items-center gap-3">
							<Badge variant="secondary" className="text-xs">
								Created by {project.createdBy.name}
							</Badge>
						</div>
					</div>
				</div>
			</div>

			{/* Toolbar */}
			<div className="border-b bg-muted/30">
				<div className="flex flex-col sm:flex-row gap-3 p-4 items-start sm:items-center justify-between">
					<div className="flex items-center gap-2 flex-1 max-w-md">
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
							<Input
								placeholder="Search tasks..."
								className="pl-10 bg-background"
							/>
						</div>
						<Button variant="outline" size="sm">
							<Filter className="size-4" />
							<span className="hidden sm:inline">Filter</span>
						</Button>
					</div>

					<div className="flex items-center gap-2">
						<Button size="sm">
							<Plus className="size-4" />
							New Task
						</Button>
						<Button variant="outline" size="sm">
							<Plus className="size-4" />
							New Column
						</Button>
					</div>
				</div>
			</div>

			{/* Main Content Area - Kanban Board Container */}
			<div className="flex-1 overflow-hidden">
				<div className="h-full p-4 lg:p-6">
					{/* Kanban Board Placeholder */}
					<Card className="h-full border-dashed border-2 border-muted-foreground/20">
						<CardHeader className="text-center">
							<h3 className="text-lg font-semibold text-muted-foreground">
								Kanban Board
							</h3>
							<p className="text-sm text-muted-foreground">
								The kanban board will be implemented here
							</p>
						</CardHeader>
						<CardContent className="flex-1 flex items-center justify-center">
							<div className="text-center space-y-4">
								<div className="w-24 h-24 mx-auto bg-muted rounded-lg flex items-center justify-center">
									<div className="w-12 h-12 bg-primary/20 rounded flex items-center justify-center">
										<div className="w-6 h-6 bg-primary/40 rounded-sm"></div>
									</div>
								</div>
								<div className="space-y-2">
									<p className="text-sm font-medium">
										Ready for Kanban Implementation
									</p>
									<p className="text-xs text-muted-foreground max-w-sm">
										This area is prepared for the kanban board component. The
										layout is responsive and will adapt to different screen
										sizes.
									</p>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
