import type { ProjectAccent } from "@/api";
import { accentFill, hasAccent } from "@/lib/project-accent";
import { cn } from "@/lib/utils";

/**
 * The mark that says which project a row belongs to, in a list that mixes several.
 *
 * One component rather than a `<span>` per screen, because there are seven of them — the
 * dashboard/Today/Upcoming list, search, the calendar's agenda and month grid, the trash, the
 * command palette and the task page — and seven copies of a size and a shape is how the priority
 * tone ended up written five different ways before L47.5 collapsed it.
 *
 * `aria-hidden` throughout: the project's *name* is always right beside it, so the dot is a
 * second encoding of something already in the accessible name. Announcing "violet" would add
 * noise, and colour alone never carries the meaning here — which is also what keeps this the
 * right side of "don't use colour as the only channel".
 *
 * Renders nothing when the project has no accent, so an unaccented row keeps its old spacing
 * instead of reserving a gap for a dot that never comes.
 */
export function ProjectAccentDot({
  accent,
  className,
}: {
  accent: ProjectAccent | undefined;
  className?: string;
}) {
  if (!hasAccent(accent)) return null;

  return (
    <span
      aria-hidden
      className={cn(
        "size-1.5 shrink-0 rounded-full",
        accentFill(accent),
        className,
      )}
    />
  );
}
