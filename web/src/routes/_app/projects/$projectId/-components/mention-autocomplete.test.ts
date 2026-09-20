import { describe, expect, test } from "bun:test";
import {
  applyMention,
  findMentionQuery,
  matchMentionNames,
} from "./mention-autocomplete";

describe("findMentionQuery", () => {
  test("finds the mention being typed at the caret", () => {
    const text = "ping @Hel";
    expect(findMentionQuery(text, text.length)).toEqual({
      query: "Hel",
      start: 5,
    });
  });

  test("an @ just typed is a query with nothing in it yet", () => {
    // The picker has to open on "@" alone, or it only ever appears once you have already
    // guessed enough of the name to not need it.
    expect(findMentionQuery("ping @", 6)).toEqual({ query: "", start: 5 });
  });

  test("whitespace ends the query", () => {
    // Otherwise every word after an "@" keeps the picker open across the whole sentence.
    expect(findMentionQuery("email @ 5pm", 11)).toBeNull();
  });

  test("an @ inside a word is an email address, not a mention", () => {
    // The same rule the server's parser applies, so the picker never offers a mention that
    // would not be recognised once sent.
    expect(findMentionQuery("mail ana@example", 16)).toBeNull();
  });

  test("reads the query at the caret, not at the end of the text", () => {
    const text = "ping @Hel and then some more";
    expect(findMentionQuery(text, 9)).toEqual({ query: "Hel", start: 5 });
  });

  test("gives up rather than scanning an essay", () => {
    const text = `@${"a".repeat(80)}`;
    expect(findMentionQuery(text, text.length)).toBeNull();
  });
});

describe("matchMentionNames", () => {
  const names = ["Hello User", "Joe Müller", "Mallory", "Watcher"];

  test("matches the start of a name", () => {
    expect(matchMentionNames("mal", names)).toEqual(["Mallory"]);
  });

  test("matches a later word too", () => {
    // Someone looking for "Hello User" is as likely to type "@User" as "@Hello".
    expect(matchMentionNames("user", names)).toEqual(["Hello User"]);
  });

  test("ranks a whole-name match above a later-word one", () => {
    const ranked = matchMentionNames("m", ["Hello Max", "Mallory"]);
    expect(ranked).toEqual(["Mallory", "Hello Max"]);
  });

  test("an empty query offers everyone", () => {
    expect(matchMentionNames("", names)).toHaveLength(4);
  });

  test("is case-insensitive and bounded", () => {
    expect(matchMentionNames("HELLO", names)).toEqual(["Hello User"]);
    expect(matchMentionNames("", names, 2)).toHaveLength(2);
  });

  test("no match is no suggestions, not everyone", () => {
    expect(matchMentionNames("zz", names)).toEqual([]);
  });
});

describe("applyMention", () => {
  test("replaces the query with the full name and moves the caret past it", () => {
    const text = "ping @Hel";
    const mention = findMentionQuery(text, text.length)!;
    const result = applyMention(text, mention, text.length, "Hello User");

    // A full name, because that is what the server matches — completing to anything else
    // would offer mentions that silently notify nobody.
    expect(result.text).toBe("ping @Hello User ");
    expect(result.caret).toBe(result.text.length);
  });

  test("keeps whatever followed the caret", () => {
    const text = "ping @Hel about it";
    const mention = findMentionQuery(text, 9)!;
    const result = applyMention(text, mention, 9, "Hello User");

    expect(result.text).toBe("ping @Hello User  about it");
    expect(result.text.slice(result.caret)).toBe(" about it");
  });

  test("the trailing space closes the query", () => {
    const text = "@Mal";
    const result = applyMention(text, findMentionQuery(text, 4)!, 4, "Mallory");

    // Without it the picker reopens on the name it just inserted.
    expect(findMentionQuery(result.text, result.caret)).toBeNull();
  });
});
