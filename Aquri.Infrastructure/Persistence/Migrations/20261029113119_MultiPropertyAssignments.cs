using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Aquri.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class MultiPropertyAssignments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserPropertyAssignments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    PropertyId = table.Column<int>(type: "integer", nullable: false),
                    Created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserPropertyAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserPropertyAssignments_Properties_PropertyId",
                        column: x => x.PropertyId,
                        principalTable: "Properties",
                        principalColumn: "PropertyId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserPropertyAssignments_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserPropertyAssignments_PropertyId",
                table: "UserPropertyAssignments",
                column: "PropertyId");

            migrationBuilder.CreateIndex(
                name: "IX_UserPropertyAssignments_UserId_PropertyId",
                table: "UserPropertyAssignments",
                columns: new[] { "UserId", "PropertyId" },
                unique: true);

            // Backfill: every existing scoped account becomes an assignment for
            // its current PropertyId. Without this an upgraded database would
            // leave employees with an empty scope and lock them out.
            migrationBuilder.Sql(
                """
                INSERT INTO "UserPropertyAssignments" ("UserId", "PropertyId", "Created")
                SELECT "Id", "PropertyId", now() FROM "Users" WHERE "PropertyId" IS NOT NULL
                ON CONFLICT ("UserId", "PropertyId") DO NOTHING;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserPropertyAssignments");
        }
    }
}
