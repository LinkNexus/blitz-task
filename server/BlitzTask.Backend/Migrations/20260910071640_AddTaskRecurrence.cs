using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlitzTask.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddTaskRecurrence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "RecurrenceSpawnedAt",
                table: "ProjectTasks",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "TaskRecurrences",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ProjectTaskId = table.Column<int>(type: "INTEGER", nullable: false),
                    Frequency = table.Column<int>(type: "INTEGER", nullable: false),
                    Interval = table.Column<int>(type: "INTEGER", nullable: false),
                    Weekdays = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaskRecurrences", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TaskRecurrences_ProjectTasks_ProjectTaskId",
                        column: x => x.ProjectTaskId,
                        principalTable: "ProjectTasks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TaskRecurrences_ProjectTaskId",
                table: "TaskRecurrences",
                column: "ProjectTaskId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TaskRecurrences");

            migrationBuilder.DropColumn(
                name: "RecurrenceSpawnedAt",
                table: "ProjectTasks");
        }
    }
}
