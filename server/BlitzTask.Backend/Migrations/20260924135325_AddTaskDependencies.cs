using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlitzTask.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddTaskDependencies : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ProjectTaskDependencies",
                columns: table => new
                {
                    DependentTaskId = table.Column<int>(type: "INTEGER", nullable: false),
                    DependsOnTaskId = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectTaskDependencies", x => new { x.DependentTaskId, x.DependsOnTaskId });
                    table.ForeignKey(
                        name: "FK_ProjectTaskDependencies_ProjectTasks_DependentTaskId",
                        column: x => x.DependentTaskId,
                        principalTable: "ProjectTasks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProjectTaskDependencies_ProjectTasks_DependsOnTaskId",
                        column: x => x.DependsOnTaskId,
                        principalTable: "ProjectTasks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProjectTaskDependencies_DependsOnTaskId",
                table: "ProjectTaskDependencies",
                column: "DependsOnTaskId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProjectTaskDependencies");
        }
    }
}
