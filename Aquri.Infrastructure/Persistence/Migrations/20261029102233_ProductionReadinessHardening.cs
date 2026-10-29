using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquri.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ProductionReadinessHardening : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Payments_PropertyId",
                table: "Payments");

            migrationBuilder.AddColumn<string>(
                name: "Currency",
                table: "Properties",
                type: "character varying(3)",
                maxLength: 3,
                nullable: false,
                defaultValue: "ZAR");

            migrationBuilder.AddColumn<string>(
                name: "IdempotencyKey",
                table: "Payments",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "PropertyId",
                table: "AuditLogs",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_PropertyId_IdempotencyKey",
                table: "Payments",
                columns: new[] { "PropertyId", "IdempotencyKey" },
                unique: true,
                filter: "\"IdempotencyKey\" IS NOT NULL");

            // No two non-cancelled bookings for the same room may overlap in
            // time. Back-to-back (check-out equals check-in) stays legal because
            // tstzrange with '[)' excludes the upper bound. Raw SQL: EF Core
            // has no model mapping for exclusion constraints. btree_gist is
            // required for the integer equality operator inside GiST, and the
            // partial predicate must be wrapped in parentheses.
            migrationBuilder.Sql("CREATE EXTENSION IF NOT EXISTS btree_gist;");
            migrationBuilder.Sql(
                """ALTER TABLE "Bookings" ADD CONSTRAINT "CK_Bookings_NoOverlap" EXCLUDE USING gist ("RoomId" WITH =, tstzrange("CheckIn", "CheckOut", '[)') WITH &&) WHERE ("Status" <> 'cancelled');""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """ALTER TABLE "Bookings" DROP CONSTRAINT IF EXISTS "CK_Bookings_NoOverlap";""");

            migrationBuilder.DropIndex(
                name: "IX_Payments_PropertyId_IdempotencyKey",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "Currency",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "IdempotencyKey",
                table: "Payments");

            migrationBuilder.AlterColumn<int>(
                name: "PropertyId",
                table: "AuditLogs",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Payments_PropertyId",
                table: "Payments",
                column: "PropertyId");
        }
    }
}
