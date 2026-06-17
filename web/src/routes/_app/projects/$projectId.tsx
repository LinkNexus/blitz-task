import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { getProjectOptions } from "@/api/@tanstack/react-query.gen";

export const Route = createFileRoute("/_app/projects/$projectId")({
  loader: ({ params, context }) => {
    return context.queryClient.ensureQueryData(
      getProjectOptions({
        path: { projectId: Number(params.projectId) },
      }),
    );
  },
  component: SingleProjectPage,
});

function SingleProjectPage() {
  const { projectId } = Route.useParams();

  const { data: project } = useSuspenseQuery(
    getProjectOptions({
      path: { projectId: Number(projectId) },
    }),
  );

  return (
    <>
      <h1 className="text-3xl font-bold mb-4">{project.name}</h1>
      <p className="text-muted-foreground mb-4">{project.description}</p>

      <div className="space-y-4">
        <div>
          <h2 className="font-semibold">Project ID</h2>
          <p className="text-sm text-muted-foreground">{project.id}</p>
        </div>

        {project.startDate && (
          <div>
            <h2 className="font-semibold">Start Date</h2>
            <p className="text-sm text-muted-foreground">
              {new Date(project.startDate).toLocaleDateString()}
            </p>
          </div>
        )}

        {project.dueDate && (
          <div>
            <h2 className="font-semibold">Due Date</h2>
            <p className="text-sm text-muted-foreground">
              {new Date(project.dueDate).toLocaleDateString()}
            </p>
          </div>
        )}

        {project.tags.length > 0 && (
          <div>
            <h2 className="font-semibold mb-2">Tags</h2>
            <div className="flex flex-wrap gap-2">
              {project.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-primary/10 text-primary rounded-md text-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="font-semibold mb-2">Participants</h2>
          <div className="space-y-2">
            {project.participants.map((participant) => (
              <div
                key={participant.userId}
                className="flex items-center justify-between p-2 border rounded"
              >
                <div>
                  <p className="font-medium">{participant.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {participant.role}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Joined {new Date(participant.joinedAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
