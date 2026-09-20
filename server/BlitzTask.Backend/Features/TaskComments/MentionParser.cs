namespace BlitzTask.Backend.Features.TaskComments
{
    /// <summary>One person a comment could be talking to.</summary>
    public record MentionCandidate(int UserId, string Name);

    /// <summary>
    /// Works out who a comment is addressing.
    /// <para>
    /// <b>Matched against the project's participants, not against all users.</b> A person here has
    /// a display name and no unique handle, so "@Alex" is only answerable within some set — and
    /// scoping that set to the project is what makes the whole feature safe rather than merely
    /// convenient: you cannot mention someone who is not in the project, so a mention can never
    /// carry a task's name to a stranger, and the notification it produces can never point at a
    /// board its recipient would be refused.
    /// </para>
    /// <para>
    /// The alternatives were worse. A global name lookup makes every stranger mentionable and
    /// every common name ambiguous. A handle column (<c>@mallory</c>) means a schema change, a
    /// uniqueness rule and a backfill for existing accounts. An explicit syntax carrying an id
    /// (<c>@[Mallory](user:2)</c>) is unambiguous but only if something writes it for you — which
    /// is an autocomplete, i.e. the expensive half — and it leaves the raw markdown unreadable to
    /// anyone who edits it by hand.
    /// </para>
    /// </summary>
    public static class MentionParser
    {
        public static List<int> FindMentionedUserIds(
            string body,
            IEnumerable<MentionCandidate> candidates
        )
        {
            List<int> mentioned = [];

            if (string.IsNullOrWhiteSpace(body))
                return mentioned;

            // Longest name first, so "@Ana Maria" is read as Ana Maria rather than as Ana
            // followed by stray text. Ordering is half of the disambiguation; claiming the text
            // a match consumed is the other half, or the shorter name matches *inside* the
            // longer one and both people get pulled in.
            var ordered = candidates
                .Where(c => !string.IsNullOrWhiteSpace(c.Name))
                .OrderByDescending(c => c.Name.Length)
                .ToList();

            List<(int Start, int End)> claimed = [];

            foreach (var candidate in ordered)
            {
                if (mentioned.Contains(candidate.UserId))
                    continue;

                var at = FindMention(body, candidate.Name, claimed);
                if (at is null)
                    continue;

                mentioned.Add(candidate.UserId);
                claimed.Add((at.Value, at.Value + candidate.Name.Length + 1));
            }

            return mentioned;
        }

        /// <summary>
        /// Where <paramref name="name"/> is mentioned in <paramref name="body"/>, or null.
        /// Returns the index of the <c>@</c>, so the caller can mark the span as spoken for.
        /// </summary>
        private static int? FindMention(
            string body,
            string name,
            List<(int Start, int End)> claimed
        )
        {
            var needle = "@" + name;
            var index = body.IndexOf(needle, StringComparison.OrdinalIgnoreCase);

            while (index >= 0)
            {
                var end = index + needle.Length;

                // The name has to end where the match ends. Without this, a project containing
                // both "Ana" and "Anabelle" would read "@Anabelle" as a mention of Ana whenever
                // Anabelle happened to be looked at second.
                var endsCleanly = end >= body.Length || !char.IsLetterOrDigit(body[end]);

                // And it has to start at an "@" that begins something — not the one in the middle
                // of an email address, where "@example" is a domain rather than a person.
                var startsCleanly = index == 0 || !char.IsLetterOrDigit(body[index - 1]);

                // And it must not be text a longer name already accounted for.
                var free = !claimed.Any(c => index < c.End && end > c.Start);

                if (endsCleanly && startsCleanly && free)
                    return index;

                index = body.IndexOf(needle, index + 1, StringComparison.OrdinalIgnoreCase);
            }

            return null;
        }
    }
}
