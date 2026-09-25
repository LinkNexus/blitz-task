using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlitzTask.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddPushNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Corrected by hand, and the correction is the whole point of reading this file.
            //
            // EF generated the rename the other way round — `SentAt` to `PushSentAt`, with
            // `EmailSentAt` added fresh — because it matches columns by shape and has no idea
            // what the existing values *mean*. They record emails that were already sent. Applied
            // as generated, every historical reminder would read as "push already delivered" (so
            // no push ever fires for it) and as "email never sent" — and the next sweep would
            // re-send every one of those emails. That is precisely the duplicate this feature's
            // per-channel split exists to prevent, arriving through the migration rather than
            // the code.
            migrationBuilder.RenameColumn(
                name: "SentAt",
                table: "TaskReminders",
                newName: "EmailSentAt");

            // Genuinely new: nothing has ever been pushed, so null for every existing row is
            // the truth rather than a default.
            migrationBuilder.AddColumn<DateTime>(
                name: "PushSentAt",
                table: "TaskReminders",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PushSubscriptions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    UserId = table.Column<int>(type: "INTEGER", nullable: false),
                    Endpoint = table.Column<string>(type: "TEXT", maxLength: 1024, nullable: false),
                    P256dh = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    Auth = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PushSubscriptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PushSubscriptions_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PushSubscriptions_Endpoint",
                table: "PushSubscriptions",
                column: "Endpoint",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PushSubscriptions_UserId",
                table: "PushSubscriptions",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PushSubscriptions");

            // Mirrors the corrected Up: the email column is the one that was always there.
            migrationBuilder.DropColumn(
                name: "PushSentAt",
                table: "TaskReminders");

            migrationBuilder.RenameColumn(
                name: "EmailSentAt",
                table: "TaskReminders",
                newName: "SentAt");
        }
    }
}
