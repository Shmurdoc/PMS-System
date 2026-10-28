using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Aquri.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class P0MoneyPath : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "IdempotencyKey",
                table: "Payments",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Payments_IdempotencyKey",
                table: "Payments",
                columns: new[] { "PropertyId", "IdempotencyKey" },
                unique: true,
                filter: "\"IdempotencyKey\" IS NOT NULL");

            // Prevent double-booking: no two non-cancelled bookings for the
            // same room may overlap in time. Back-to-back (check-out == check-in)
            // is allowed because tstzrange '[)' excludes the upper bound.
            migrationBuilder.Sql(@"
                ALTER TABLE ""Bookings""
                ADD CONSTRAINT ""CK_Bookings_NoOverlap""
                EXCLUDE USING gist (
                    ""RoomId"" WITH =,
                    tstzrange(""CheckIn"", ""CheckOut"", '[)') WITH &&
                )
                WHERE ""Status"" <> 'cancelled';
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE ""Bookings""
                DROP CONSTRAINT IF EXISTS ""CK_Bookings_NoOverlap"";
            ");

            migrationBuilder.DropIndex(
                name: "IX_Payments_IdempotencyKey",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "IdempotencyKey",
                table: "Payments");
        }
    }
}
