using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquri.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ReferencePropertyTenantKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AiInsights_Properties_PropertyId",
                table: "AiInsights");

            migrationBuilder.DropForeignKey(
                name: "FK_AttendanceRecords_Properties_PropertyId",
                table: "AttendanceRecords");

            migrationBuilder.DropForeignKey(
                name: "FK_AuditLogs_Properties_PropertyId",
                table: "AuditLogs");

            migrationBuilder.DropForeignKey(
                name: "FK_Bookings_Properties_PropertyId",
                table: "Bookings");

            migrationBuilder.DropForeignKey(
                name: "FK_ElectricityRecords_Properties_PropertyId",
                table: "ElectricityRecords");

            migrationBuilder.DropForeignKey(
                name: "FK_Expenses_Properties_PropertyId",
                table: "Expenses");

            migrationBuilder.DropForeignKey(
                name: "FK_Integrations_Properties_PropertyId",
                table: "Integrations");

            migrationBuilder.DropForeignKey(
                name: "FK_InventoryItems_Properties_PropertyId",
                table: "InventoryItems");

            migrationBuilder.DropForeignKey(
                name: "FK_Invoices_Properties_PropertyId",
                table: "Invoices");

            migrationBuilder.DropForeignKey(
                name: "FK_Messages_Properties_PropertyId",
                table: "Messages");

            migrationBuilder.DropForeignKey(
                name: "FK_Payments_Properties_PropertyId",
                table: "Payments");

            migrationBuilder.DropForeignKey(
                name: "FK_RatePlans_Properties_PropertyId",
                table: "RatePlans");

            migrationBuilder.DropForeignKey(
                name: "FK_RfidTags_Properties_PropertyId",
                table: "RfidTags");

            migrationBuilder.DropForeignKey(
                name: "FK_Shifts_Properties_PropertyId",
                table: "Shifts");

            migrationBuilder.DropForeignKey(
                name: "FK_TaxConfigs_Properties_PropertyId",
                table: "TaxConfigs");

            migrationBuilder.DropForeignKey(
                name: "FK_Tickets_Properties_PropertyId",
                table: "Tickets");

            migrationBuilder.DropForeignKey(
                name: "FK_Workflows_Properties_PropertyId",
                table: "Workflows");

            migrationBuilder.DropIndex(
                name: "IX_Properties_PropertyId",
                table: "Properties");

            migrationBuilder.AddUniqueConstraint(
                name: "AK_Properties_PropertyId",
                table: "Properties",
                column: "PropertyId");

            migrationBuilder.AddForeignKey(
                name: "FK_AiInsights_Properties_PropertyId",
                table: "AiInsights",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "PropertyId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_AttendanceRecords_Properties_PropertyId",
                table: "AttendanceRecords",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "PropertyId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_AuditLogs_Properties_PropertyId",
                table: "AuditLogs",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "PropertyId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Bookings_Properties_PropertyId",
                table: "Bookings",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "PropertyId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ElectricityRecords_Properties_PropertyId",
                table: "ElectricityRecords",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "PropertyId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Expenses_Properties_PropertyId",
                table: "Expenses",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "PropertyId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Integrations_Properties_PropertyId",
                table: "Integrations",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "PropertyId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_InventoryItems_Properties_PropertyId",
                table: "InventoryItems",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "PropertyId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Invoices_Properties_PropertyId",
                table: "Invoices",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "PropertyId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Messages_Properties_PropertyId",
                table: "Messages",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "PropertyId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Payments_Properties_PropertyId",
                table: "Payments",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "PropertyId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_RatePlans_Properties_PropertyId",
                table: "RatePlans",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "PropertyId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_RfidTags_Properties_PropertyId",
                table: "RfidTags",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "PropertyId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Shifts_Properties_PropertyId",
                table: "Shifts",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "PropertyId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_TaxConfigs_Properties_PropertyId",
                table: "TaxConfigs",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "PropertyId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Tickets_Properties_PropertyId",
                table: "Tickets",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "PropertyId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Workflows_Properties_PropertyId",
                table: "Workflows",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "PropertyId",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AiInsights_Properties_PropertyId",
                table: "AiInsights");

            migrationBuilder.DropForeignKey(
                name: "FK_AttendanceRecords_Properties_PropertyId",
                table: "AttendanceRecords");

            migrationBuilder.DropForeignKey(
                name: "FK_AuditLogs_Properties_PropertyId",
                table: "AuditLogs");

            migrationBuilder.DropForeignKey(
                name: "FK_Bookings_Properties_PropertyId",
                table: "Bookings");

            migrationBuilder.DropForeignKey(
                name: "FK_ElectricityRecords_Properties_PropertyId",
                table: "ElectricityRecords");

            migrationBuilder.DropForeignKey(
                name: "FK_Expenses_Properties_PropertyId",
                table: "Expenses");

            migrationBuilder.DropForeignKey(
                name: "FK_Integrations_Properties_PropertyId",
                table: "Integrations");

            migrationBuilder.DropForeignKey(
                name: "FK_InventoryItems_Properties_PropertyId",
                table: "InventoryItems");

            migrationBuilder.DropForeignKey(
                name: "FK_Invoices_Properties_PropertyId",
                table: "Invoices");

            migrationBuilder.DropForeignKey(
                name: "FK_Messages_Properties_PropertyId",
                table: "Messages");

            migrationBuilder.DropForeignKey(
                name: "FK_Payments_Properties_PropertyId",
                table: "Payments");

            migrationBuilder.DropForeignKey(
                name: "FK_RatePlans_Properties_PropertyId",
                table: "RatePlans");

            migrationBuilder.DropForeignKey(
                name: "FK_RfidTags_Properties_PropertyId",
                table: "RfidTags");

            migrationBuilder.DropForeignKey(
                name: "FK_Shifts_Properties_PropertyId",
                table: "Shifts");

            migrationBuilder.DropForeignKey(
                name: "FK_TaxConfigs_Properties_PropertyId",
                table: "TaxConfigs");

            migrationBuilder.DropForeignKey(
                name: "FK_Tickets_Properties_PropertyId",
                table: "Tickets");

            migrationBuilder.DropForeignKey(
                name: "FK_Workflows_Properties_PropertyId",
                table: "Workflows");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_Properties_PropertyId",
                table: "Properties");

            migrationBuilder.CreateIndex(
                name: "IX_Properties_PropertyId",
                table: "Properties",
                column: "PropertyId");

            migrationBuilder.AddForeignKey(
                name: "FK_AiInsights_Properties_PropertyId",
                table: "AiInsights",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_AttendanceRecords_Properties_PropertyId",
                table: "AttendanceRecords",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_AuditLogs_Properties_PropertyId",
                table: "AuditLogs",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Bookings_Properties_PropertyId",
                table: "Bookings",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ElectricityRecords_Properties_PropertyId",
                table: "ElectricityRecords",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Expenses_Properties_PropertyId",
                table: "Expenses",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Integrations_Properties_PropertyId",
                table: "Integrations",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_InventoryItems_Properties_PropertyId",
                table: "InventoryItems",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Invoices_Properties_PropertyId",
                table: "Invoices",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Messages_Properties_PropertyId",
                table: "Messages",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Payments_Properties_PropertyId",
                table: "Payments",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_RatePlans_Properties_PropertyId",
                table: "RatePlans",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_RfidTags_Properties_PropertyId",
                table: "RfidTags",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Shifts_Properties_PropertyId",
                table: "Shifts",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_TaxConfigs_Properties_PropertyId",
                table: "TaxConfigs",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Tickets_Properties_PropertyId",
                table: "Tickets",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Workflows_Properties_PropertyId",
                table: "Workflows",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
