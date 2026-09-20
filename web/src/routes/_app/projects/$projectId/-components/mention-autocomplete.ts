/**
 * The typing half of a mention.
 *
 * Kept as pure functions over `(text, caret)` rather than inside the component, because the
 * fiddly parts — where a query starts, when it stops being one — are exactly what is worth
 * testing, and none of it needs a DOM.
 *
 * What it inserts is a **full name**, which is the contract with the server: `MentionParser`
 * matches complete participant names, so anything this completes to is something that notifies.
 * A picker that inserted anything else would be offering mentions that silently do nothing.
 */

/** How far back to look for an `@`. Past this, the user is writing prose, not a name. */
const MAX_QUERY_LENGTH = 40;

export type MentionQuery = {
  /** What has been typed after the `@`, which may be empty right after typing it. */
  query: string;
  /** Index of the `@` itself, so an accepted name can replace the whole thing. */
  start: number;
};

/**
 * The mention being typed at the caret, or null.
 *
 * Whitespace ends the search deliberately: the query is a single token, so "@" followed by a
 * word is a mention and "email @ 5pm" is not. That means a two-word name like "Hello User"
 * cannot be typed out in full and still match — you type "@Hel", pick, and the picker inserts
 * the space for you.
 */
export function findMentionQuery(
  text: string,
  caret: number,
): MentionQuery | null {
  const from = Math.max(0, caret - MAX_QUERY_LENGTH);

  for (let i = caret - 1; i >= from; i--) {
    const char = text[i];

    if (char === "@") {
      const before = i > 0 ? text[i - 1] : "";
      // An "@" inside a word is an email address. Same rule as the server's parser, so the
      // picker does not offer a mention where a mention would not be recognised.
      if (before && /[\p{L}\p{N}]/u.test(before)) return null;

      return { query: text.slice(i + 1, caret), start: i };
    }

    if (/\s/.test(char)) return null;
  }

  return null;
}

/**
 * Participants worth offering for a query.
 *
 * Matches any **word** of a name, not just its start — someone looking for "Hello User" is as
 * likely to type "@User" as "@Hello", and a picker that only answers the first is one people
 * stop trusting. Whole-name matches are ranked first so the obvious case stays on top.
 */
export function matchMentionNames(
  query: string,
  names: string[],
  limit = 6,
): string[] {
  const needle = query.trim().toLowerCase();

  const scored = names
    .map((name) => {
      const lower = name.toLowerCase();

      if (needle === "") return { name, rank: 1 };
      if (lower.startsWith(needle)) return { name, rank: 0 };
      if (lower.split(/\s+/).some((word) => word.startsWith(needle)))
        return { name, rank: 1 };

      return null;
    })
    .filter((match) => match !== null);

  return scored
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((match) => match.name);
}

/**
 * Replaces the query with the chosen name, and says where the caret should end up.
 *
 * The trailing space is not cosmetic: it closes the query, so the picker does not immediately
 * reopen on the name that was just accepted.
 */
export function applyMention(
  text: string,
  mention: MentionQuery,
  caret: number,
  name: string,
): { text: string; caret: number } {
  const inserted = `@${name} `;

  return {
    text: text.slice(0, mention.start) + inserted + text.slice(caret),
    caret: mention.start + inserted.length,
  };
}
