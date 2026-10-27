using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquri.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddGuestPropertyScope : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PropertyId",
                table: "Guests",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql(
                "UPDATE \"Guests\" g SET \"PropertyId\" = COALESCE((SELECT b.\"PropertyId\" FROM \"Bookings\" b WHERE b.\"GuestId\" = g.\"Id\" ORDER BY b.\"Id\" LIMIT 1), 1);");

            migrationBuilder.CreateIndex(
                name: "IX_Guests_PropertyId",
                table: "Guests",
                column: "PropertyId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Guests_PropertyId",
                table: "Guests");

            migrationBuilder.DropColumn(
                name: "PropertyId",
                table: "Guests");
        }
    }
}
