using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlitzTask.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddGuidToProjectInvitation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProjectInvitation_Projects_ProjectId",
                table: "ProjectInvitation");

            migrationBuilder.DropPrimaryKey(
                name: "PK_ProjectInvitation",
                table: "ProjectInvitation");

            migrationBuilder.RenameTable(
                name: "ProjectInvitation",
                newName: "ProjectInvitations");

            migrationBuilder.RenameIndex(
                name: "IX_ProjectInvitation_ProjectId",
                table: "ProjectInvitations",
                newName: "IX_ProjectInvitations_ProjectId");

            migrationBuilder.AddColumn<Guid>(
                name: "Token",
                table: "ProjectInvitations",
                type: "TEXT",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddPrimaryKey(
                name: "PK_ProjectInvitations",
                table: "ProjectInvitations",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_ProjectInvitations_Projects_ProjectId",
                table: "ProjectInvitations",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProjectInvitations_Projects_ProjectId",
                table: "ProjectInvitations");

            migrationBuilder.DropPrimaryKey(
                name: "PK_ProjectInvitations",
                table: "ProjectInvitations");

            migrationBuilder.DropColumn(
                name: "Token",
                table: "ProjectInvitations");

            migrationBuilder.RenameTable(
                name: "ProjectInvitations",
                newName: "ProjectInvitation");

            migrationBuilder.RenameIndex(
                name: "IX_ProjectInvitations_ProjectId",
                table: "ProjectInvitation",
                newName: "IX_ProjectInvitation_ProjectId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_ProjectInvitation",
                table: "ProjectInvitation",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_ProjectInvitation_Projects_ProjectId",
                table: "ProjectInvitation",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
