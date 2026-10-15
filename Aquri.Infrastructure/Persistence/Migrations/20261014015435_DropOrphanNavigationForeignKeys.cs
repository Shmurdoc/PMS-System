using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquri.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class DropOrphanNavigationForeignKeys : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Bookings_Guests_GuestId1",
                table: "Bookings");

            migrationBuilder.DropForeignKey(
                name: "FK_Bookings_Rooms_RoomId1",
                table: "Bookings");

            migrationBuilder.DropForeignKey(
                name: "FK_Invoices_Guests_GuestId1",
                table: "Invoices");

            migrationBuilder.DropForeignKey(
                name: "FK_Payments_Guests_GuestId1",
                table: "Payments");

            migrationBuilder.DropForeignKey(
                name: "FK_Tickets_Guests_GuestId1",
                table: "Tickets");

            migrationBuilder.DropIndex(
                name: "IX_Tickets_GuestId1",
                table: "Tickets");

            migrationBuilder.DropIndex(
                name: "IX_Payments_GuestId1",
                table: "Payments");

            migrationBuilder.DropIndex(
                name: "IX_Invoices_GuestId1",
                table: "Invoices");

            migrationBuilder.DropIndex(
                name: "IX_Bookings_GuestId1",
                table: "Bookings");

            migrationBuilder.DropIndex(
                name: "IX_Bookings_RoomId1",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "GuestId1",
                table: "Tickets");

            migrationBuilder.DropColumn(
                name: "GuestId1",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "GuestId1",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "GuestId1",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "RoomId1",
                table: "Bookings");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "GuestId1",
                table: "Tickets",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "GuestId1",
                table: "Payments",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "GuestId1",
                table: "Invoices",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "GuestId1",
                table: "Bookings",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RoomId1",
                table: "Bookings",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Tickets_GuestId1",
                table: "Tickets",
                column: "GuestId1");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_GuestId1",
                table: "Payments",
                column: "GuestId1");

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_GuestId1",
                table: "Invoices",
                column: "GuestId1");

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_GuestId1",
                table: "Bookings",
                column: "GuestId1");

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_RoomId1",
                table: "Bookings",
                column: "RoomId1");

            migrationBuilder.AddForeignKey(
                name: "FK_Bookings_Guests_GuestId1",
                table: "Bookings",
                column: "GuestId1",
                principalTable: "Guests",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Bookings_Rooms_RoomId1",
                table: "Bookings",
                column: "RoomId1",
                principalTable: "Rooms",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Invoices_Guests_GuestId1",
                table: "Invoices",
                column: "GuestId1",
                principalTable: "Guests",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Payments_Guests_GuestId1",
                table: "Payments",
                column: "GuestId1",
                principalTable: "Guests",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Tickets_Guests_GuestId1",
                table: "Tickets",
                column: "GuestId1",
                principalTable: "Guests",
                principalColumn: "Id");
        }
    }
}
