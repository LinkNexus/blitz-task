import { IconFolderPlus } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

/**
 * The empty state for someone who has not started, as opposed to someone who is finished.
 *
 * Dashboard, Today and Upcoming all read the same `listUserTasks` payload, and all three wrote
 * their empty state for the steady case — "Every task in your projects is in its final column",
 * "Nothing is late or due today". Those are true and useful *once you have projects*. To an
 * account with none they are nonsense dressed as reassurance: they describe the state of a set
 * that does not exist, and they say nothing about what to do next.
 *
 * The two states are told apart by the project list, not by the task list — a user can have
 * projects and no tasks, which is genuinely "nothing due", and the difference is exactly the one
 * these screens were collapsing. `listProjects` is already in cache from the sidebar, which
 * renders on every authenticated page, so asking for it here costs no request.
 *
 * Since L48 a new account arrives with a welcome project, so this is mostly what an account sees
 * after deleting everything — but it is also what every account that predates that change sees,
 * because a welcome board retrofitted onto an established account would be an intrusion.
 */
export function NoProjectsYet({
  /**
   * The dashboard already renders a projects panel with its own "create one" button, and two
   * calls to action a few hundred pixels apart read as a page that is nagging.
   */
  withAction = true,
}: {
  withAction?: boolean;
}) {
  return (
    <>
      <IconFolderPlus className="size-8 text-muted-foreground/50" />
      <p className="text-sm font-medium">Nothing here yet</p>
      <p className="max-w-xs text-xs text-muted-foreground">
        This list is filled from the projects you are in, and you are not in any
        yet.
      </p>
      {withAction && (
        <Button asChild size="sm" className="mt-2">
          <Link to="/projects/create">Create a project</Link>
        </Button>
      )}
    </>
  );
}
