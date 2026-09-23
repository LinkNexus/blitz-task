using System.Text;

namespace BlitzTask.Backend.Features.Export
{
    /// <summary>
    /// Enough CSV to write a spreadsheet, and no more.
    /// <para>
    /// Hand-rolled rather than a package because the whole job is one row shape and two escaping
    /// rules — but both rules matter, and neither is obvious.
    /// </para>
    /// </summary>
    public static class CsvWriter
    {
        /// <summary>
        /// Excel will not read UTF-8 without it. Omit the BOM and every accented name in the
        /// export opens as mojibake, which reads as "the export is broken" rather than "the
        /// spreadsheet guessed the encoding".
        /// </summary>
        public const string Bom = "﻿";

        /// <summary>
        /// Leading characters that make Excel and Google Sheets treat a cell as a formula rather
        /// than as text.
        /// </summary>
        private static readonly char[] FormulaTriggers = ['=', '+', '-', '@', '\t', '\r'];

        /// <summary>Characters that force a field to be quoted.</summary>
        private static readonly char[] QuoteTriggers = [',', '"', '\n', '\r'];

        public static string Write(IEnumerable<string> headers, IEnumerable<IEnumerable<string?>> rows)
        {
            var builder = new StringBuilder(Bom);

            // Headers are ours, but they go through the same escaping — one code path is easier
            // to trust than two, and a column named "Due date" costs nothing to quote.
            builder.Append(Row(headers));

            foreach (var row in rows)
                builder.Append(Row(row));

            return builder.ToString();
        }

        private static string Row(IEnumerable<string?> fields) =>
            string.Join(',', fields.Select(Field)) + "\r\n";

        /// <summary>
        /// One cell, escaped.
        /// <para>
        /// <b>The formula guard is the part that is not bookkeeping.</b> A cell whose text starts
        /// with <c>=</c>, <c>+</c>, <c>-</c>, <c>@</c>, a tab or a carriage return is executed as
        /// a formula when the file is opened, and every value in this export — a task name, a
        /// tag, a comment — is text somebody typed into a shared board. That makes a downloaded
        /// export a delivery mechanism for whatever a collaborator put in a task title. Prefixing
        /// with an apostrophe is the standard defusal: spreadsheets read it as "this is text" and
        /// do not show it.
        /// </para>
        /// <para>
        /// Quoting is the ordinary half, and it is required here rather than optional: task
        /// descriptions are markdown and routinely contain commas and newlines, so an unquoted
        /// writer would silently shift every later column of that row.
        /// </para>
        /// </summary>
        public static string Field(string? value)
        {
            if (string.IsNullOrEmpty(value))
                return "";

            var text = value;

            if (FormulaTriggers.Contains(text[0]))
                text = "'" + text;

            if (text.IndexOfAny(QuoteTriggers) >= 0)
                text = '"' + text.Replace("\"", "\"\"") + '"';

            return text;
        }
    }
}
