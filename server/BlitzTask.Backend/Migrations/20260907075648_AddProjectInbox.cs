using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlitzTask.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectInbox : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsInbox",
                table: "Projects",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_Projects_InboxPerUser",
                table: "Projects",
                column: "CreatedById",
                unique: true,
                filter: "\"IsInbox\" = 1");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Projects_InboxPerUser",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "IsInbox",
                table: "Projects");
        }
    }
}
