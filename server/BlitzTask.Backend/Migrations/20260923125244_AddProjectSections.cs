using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlitzTask.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectSections : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SectionId",
                table: "ProjectTasks",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ProjectSections",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ProjectId = table.Column<int>(type: "INTEGER", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 60, nullable: false),
                    Color = table.Column<string>(type: "TEXT", maxLength: 9, nullable: false),
                    Score = table.Column<float>(type: "REAL", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectSections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProjectSections_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProjectTasks_SectionId",
                table: "ProjectTasks",
                column: "SectionId");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectSections_ProjectId_Score",
                table: "ProjectSections",
                columns: new[] { "ProjectId", "Score" });

            migrationBuilder.AddForeignKey(
                name: "FK_ProjectTasks_ProjectSections_SectionId",
                table: "ProjectTasks",
                column: "SectionId",
                principalTable: "ProjectSections",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProjectTasks_ProjectSections_SectionId",
                table: "ProjectTasks");

            migrationBuilder.DropTable(
                name: "ProjectSections");

            migrationBuilder.DropIndex(
                name: "IX_ProjectTasks_SectionId",
                table: "ProjectTasks");

            migrationBuilder.DropColumn(
                name: "SectionId",
                table: "ProjectTasks");
        }
    }
}
