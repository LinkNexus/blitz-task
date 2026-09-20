import {
  IconFolder,
  IconMessage,
  IconSearch,
  IconSquareCheck,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import type { ReactNode } from "react";
import z from "zod";
import { searchOptions } from "@/api/@tanstack/react-query.gen";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

/** Mirrors the server's floor, so the UI can explain the silence instead of looking broken. */
const MIN_QUERY_LENGTH = 2;

const searchSchema = z.object({
  /** In the URL so a search survives a reload, a back, and being sent to someone. */
  q: z.string().optional(),
});

export const Route = createFileRoute("/_app/search")({
  validateSearch: searchSchema,
  component: SearchPage,
});

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </h2>
      <ul className="space-y-1">{children}</ul>
    </section>
  );
}

const ROW_CLASS =
  "block rounded-lg border bg-card px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-muted";

/**
 * A result that points at a project board, or at the Inbox when the thing lives there — its
 * board is hidden on purpose, so sending someone to it is a dead end.
 *
 * The two destinations are written out rather than passed as a string and cast: `Link` is typed
 * against the route tree, and an `any` here would turn a mistyped route into a dead link found
 * by a user rather than a build error. (L35.5 will make both of these the task itself.)
 */
function Row({
  projectId,
  isInbox,
  children,
}: {
  projectId: number | string;
  isInbox: boolean;
  children: ReactNode;
}) {
  return (
    <li>
      {isInbox ? (
        <Link to="/inbox" className={ROW_CLASS}>
          {children}
        </Link>
      ) : (
        <Link
          to="/projects/$projectId"
          params={{ projectId: String(projectId) }}
          className={ROW_CLASS}
        >
          {children}
        </Link>
      )}
    </li>
  );
}

function SearchPage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate({ from: "/search" });
  const query = (q ?? "").trim();

  const { data: results, isFetching } = useQuery({
    ...searchOptions({ query: { q: query } }),
    enabled: query.length >= MIN_QUERY_LENGTH,
  });

  const total = results
    ? results.tasks.length + results.projects.length + results.comments.length
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
        <p className="text-sm text-muted-foreground">
          Across your tasks, projects and comments.
        </p>
      </div>

      <div className="relative">
        {/* The icon sits inside the field, so the text has to clear it with a real gap rather
            than a hairline: left-3 + size-4 ends at 28px, and pl-9 left only 8px of air, which
            reads as the two touching. */}
        <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={q ?? ""}
          placeholder="Search…"
          className="h-10 pl-11"
          onChange={(e) =>
            navigate({
              search: { q: e.target.value || undefined },
              // Replace rather than push: every keystroke is not a place to go back to.
              replace: true,
            })
          }
        />
        {isFetching && (
          <Spinner className="absolute right-3 top-1/2 size-4 -translate-y-1/2" />
        )}
      </div>

      {query.length < MIN_QUERY_LENGTH ? (
        <p className="text-sm text-muted-foreground">
          {query.length === 0
            ? "Type to search."
            : `Keep going — at least ${MIN_QUERY_LENGTH} characters.`}
        </p>
      ) : results && total === 0 && !isFetching ? (
        <p className="text-sm text-muted-foreground">
          Nothing matches “{query}”.
        </p>
      ) : (
        <div className="space-y-6">
          {!!results?.tasks.length && (
            <Section
              title="Tasks"
              icon={<IconSquareCheck className="size-3.5" />}
            >
              {results.tasks.map((task) => (
                <Row
                  key={String(task.id)}
                  projectId={task.projectId}
                  isInbox={task.isInbox}
                >
                  <span className="block text-sm font-medium">{task.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {task.isInbox ? "Inbox" : task.projectName} ·{" "}
                    {task.columnName}
                  </span>
                </Row>
              ))}
            </Section>
          )}

          {!!results?.projects.length && (
            <Section
              title="Projects"
              icon={<IconFolder className="size-3.5" />}
            >
              {results.projects.map((project) => (
                <Row
                  key={String(project.id)}
                  projectId={project.id}
                  isInbox={false}
                >
                  <span className="block text-sm font-medium">
                    {project.name}
                  </span>
                  {!!project.description && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {project.description}
                    </span>
                  )}
                </Row>
              ))}
            </Section>
          )}

          {!!results?.comments.length && (
            <Section
              title="Comments"
              icon={<IconMessage className="size-3.5" />}
            >
              {results.comments.map((comment) => (
                <Row
                  key={String(comment.id)}
                  projectId={comment.projectId}
                  isInbox={comment.isInbox}
                >
                  <span className="block text-sm">{comment.excerpt}</span>
                  <span className="block text-xs text-muted-foreground">
                    {comment.authorName} on {comment.taskName} ·{" "}
                    {formatDistanceToNow(new Date(comment.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </Row>
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
