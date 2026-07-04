using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlitzTask.Backend.Migrations
{
    /// <inheritdoc />
    public partial class FixProjectTaskAttachment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProjectTaskAttachment_Projects_ProjectId",
                table: "ProjectTaskAttachment");

            migrationBuilder.DropPrimaryKey(
                name: "PK_ProjectTaskAttachment",
                table: "ProjectTaskAttachment");

            migrationBuilder.DropIndex(
                name: "IX_ProjectTaskAttachment_ProjectId",
                table: "ProjectTaskAttachment");

            migrationBuilder.DropIndex(
                name: "IX_ProjectTaskAttachment_ProjectTaskId",
                table: "ProjectTaskAttachment");

            migrationBuilder.DropColumn(
                name: "ProjectId",
                table: "ProjectTaskAttachment");

            migrationBuilder.AddPrimaryKey(
                name: "PK_ProjectTaskAttachment",
                table: "ProjectTaskAttachment",
                columns: new[] { "ProjectTaskId", "AttachmentId" });

            migrationBuilder.CreateIndex(
                name: "IX_ProjectTaskAttachment_AttachmentId",
                table: "ProjectTaskAttachment",
                column: "AttachmentId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "PK_ProjectTaskAttachment",
                table: "ProjectTaskAttachment");

            migrationBuilder.DropIndex(
                name: "IX_ProjectTaskAttachment_AttachmentId",
                table: "ProjectTaskAttachment");

            migrationBuilder.AddColumn<int>(
                name: "ProjectId",
                table: "ProjectTaskAttachment",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddPrimaryKey(
                name: "PK_ProjectTaskAttachment",
                table: "ProjectTaskAttachment",
                columns: new[] { "AttachmentId", "ProjectId" });

            migrationBuilder.CreateIndex(
                name: "IX_ProjectTaskAttachment_ProjectId",
                table: "ProjectTaskAttachment",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectTaskAttachment_ProjectTaskId",
                table: "ProjectTaskAttachment",
                column: "ProjectTaskId");

            migrationBuilder.AddForeignKey(
                name: "FK_ProjectTaskAttachment_Projects_ProjectId",
                table: "ProjectTaskAttachment",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
