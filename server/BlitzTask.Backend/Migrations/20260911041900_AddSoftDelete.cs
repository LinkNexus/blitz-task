using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlitzTask.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddSoftDelete : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "ProjectTasks",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "Projects",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "ProjectColumns",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProjectTasks_DeletedAt",
                table: "ProjectTasks",
                column: "DeletedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Projects_DeletedAt",
                table: "Projects",
                column: "DeletedAt");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectColumns_DeletedAt",
                table: "ProjectColumns",
                column: "DeletedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ProjectTasks_DeletedAt",
                table: "ProjectTasks");

            migrationBuilder.DropIndex(
                name: "IX_Projects_DeletedAt",
                table: "Projects");

            migrationBuilder.DropIndex(
                name: "IX_ProjectColumns_DeletedAt",
                table: "ProjectColumns");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "ProjectTasks");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "ProjectColumns");
        }
    }
}
