using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.ProjectColumns;
using BlitzTask.Backend.Features.ProjectMembers;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Infrastructure.Data;

namespace BlitzTask.Backend.Features.Projects
{
    /// <summary>
    /// The board a new account opens onto, instead of nothing.
    /// <para>
    /// An empty first screen is the worst thing this app can show, because every feature it has
    /// is a thing you do <i>to</i> work that already exists — a column, a priority, a deadline and
    /// a drag mean nothing without a card to try them on. So the welcome project is not a tour or
    /// a checklist of hints: it is a real board whose cards happen to describe the app, and each
    /// one is the demonstration of the thing it names.
    /// </para>
    /// <para>
    /// <b>Created once, at registration, and never again.</b> That is what makes it need no flag,
    /// no <c>IsWelcome</c> column, no unique index and no get-or-create: it is written in the same
    /// request that writes the account, so there is no second moment at which it could be created
    /// twice, and deleting it cannot resurrect it. Contrast <see cref="InboxEndpoints"/>, which
    /// <i>is</i> get-or-create with a unique index behind it — it had to keep working for the
    /// accounts that already existed when it shipped. A welcome project retrofitted onto an
    /// established account would be an intrusion rather than a help, so existing accounts
    /// deliberately never get one.
    /// </para>
    /// <para>
    /// <b>It is an entirely ordinary project.</b> Nothing branches on it: it can be renamed,
    /// shared, exported and deleted like any other, and the last card says so. Giving it a flag
    /// would have meant every query, the RBAC layer and the trash growing a special case for a
    /// board whose whole purpose is to be thrown away.
    /// </para>
    /// </summary>
    public static class WelcomeProject
    {
        /// <summary>Tasks render highest score first, so the steps count down.</summary>
        private const float FirstStep = 5000f;

        private const float StepGap = 1000f;

        /// <summary>
        /// Adds the welcome project to <paramref name="dbContext"/> for <paramref name="user"/>.
        /// <para>
        /// Adds but does not save, the same contract as <c>ActivityRecorder</c> and
        /// <c>NotificationRecorder</c> — the caller owns the transaction, so a registration that
        /// fails afterwards cannot leave a board behind for an account that does not exist.
        /// </para>
        /// </summary>
        public static Project AddFor(User user, ApplicationDbContext dbContext)
        {
            var todo = new ProjectColumn
            {
                Name = "To do",
                Score = 0,
                Color = "#6366F1",
            };
            var doing = new ProjectColumn
            {
                Name = "In progress",
                Score = 1000,
                Color = "#F59E0B",
            };
            // Completion is a *position* in this app — the highest-score column — so this one is
            // not decoration. Without it the first card's instruction would have nowhere to land.
            var done = new ProjectColumn
            {
                Name = "Done",
                Score = 2000,
                Color = "#22C55E",
            };

            var project = new Project
            {
                Name = "Welcome to Blitz Task",
                Description = "A tour you can drag around. Delete it whenever you like.",
                CreatedBy = user,
                Participants =
                [
                    new ProjectParticipant { User = user, Role = ProjectRole.Owner },
                ],
                Columns = [todo, doing, done],
            };

            var step = FirstStep;

            Add(
                project,
                todo,
                ref step,
                "Drag me to “Done”",
                "There is no tick box on a task. **Completion is a position** — a task is done "
                    + "once it sits in the board's last column, which is why every project needs "
                    + "one.\n\nDrag this card into *Done* and watch the dashboard's counts change.",
                ProjectTaskPriority.HIGH
            );

            Add(
                project,
                todo,
                ref step,
                "Give something a deadline",
                "Open this card and set a due date. A date on its own is a day; add a **time** "
                    + "and it becomes a moment, which is what lets a reminder mean \"ten minutes "
                    + "before\" rather than \"the previous midnight\".\n\nReminders are set on "
                    + "the same card, and arrive by email — and as a push notification if this "
                    + "instance has been given VAPID keys.",
                ProjectTaskPriority.MEDIUM,
                dueDate: DateTimeOffset.UtcNow.AddDays(3)
            );

            Add(
                project,
                todo,
                ref step,
                "Break a big thing into small ones",
                "This card has a checklist. Ticking an item saves immediately — it is not part of "
                    + "the card's own save, so someone else ticking something cannot be undone by "
                    + "you pressing Save on a form you opened before they did.",
                ProjectTaskPriority.LOW,
                checklist:
                [
                    "Tick this item",
                    "Add one of your own",
                    "Drag an item to reorder it",
                ]
            );

            Add(
                project,
                todo,
                ref step,
                "Write something down without deciding where it goes",
                "Press **c** anywhere in the app to capture a thought. It lands in your **Inbox**, "
                    + "which is the one place a task can exist before you have decided which "
                    + "project it belongs to. File it later from there.\n\nPress **⌘K** (or "
                    + "**Ctrl+K**) to search everything, and **d** to switch between light and "
                    + "dark.",
                ProjectTaskPriority.LOW
            );

            Add(
                project,
                doing,
                ref step,
                "Make this board yours",
                "Rename these columns, add your own, or switch to the **table**, **timeline**, "
                    + "**calendar** and **graph** views from the toolbar above. Give the project "
                    + "an accent colour in its settings and it becomes easy to pick out of a "
                    + "list that mixes several.",
                ProjectTaskPriority.MEDIUM
            );

            Add(
                project,
                done,
                ref step,
                "Read the welcome card",
                "Cards in the last column are done. You can drag this back out if you want to "
                    + "prove it.\n\nWhen you have finished exploring, open **Project settings → "
                    + "Danger Zone** and delete this board — it is an ordinary project, and "
                    + "nothing in the app treats it specially.",
                ProjectTaskPriority.LOW
            );

            dbContext.Projects.Add(project);

            return project;
        }

        private static void Add(
            Project project,
            ProjectColumn column,
            ref float score,
            string name,
            string description,
            ProjectTaskPriority priority,
            DateTimeOffset? dueDate = null,
            string[]? checklist = null
        )
        {
            var task = new ProjectTask
            {
                Name = name,
                Description = description,
                Priority = priority,
                DueDate = dueDate,
                // The date above is a day, not a moment: leaving this false is what makes the
                // card render "in 3 days" rather than claiming a deadline of midnight UTC.
                HasDueTime = false,
                Score = score,
                // Both navigations, not just the column. `RelatedProjectId` is a second foreign
                // key the column relationship says nothing about, and leaving it to EF's fixup
                // writes a zero that SQLite rejects with `FOREIGN KEY constraint failed`.
                RelatedColumn = column,
                RelatedProject = project,
                RelatedColumnId = 0,
                RelatedProjectId = 0,
                ChecklistItems =
                [
                    .. (checklist ?? []).Select(
                        (text, index) =>
                            new TaskChecklistItem
                            {
                                Text = text,
                                Position = index,
                                IsDone = false,
                            }
                    ),
                ],
            };

            column.Tasks.Add(task);
            score -= StepGap;
        }
    }
}
