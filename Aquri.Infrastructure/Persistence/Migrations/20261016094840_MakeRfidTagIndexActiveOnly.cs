using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquri.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class MakeRfidTagIndexActiveOnly : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_RfidTags_PropertyId_TagNumber",
                table: "RfidTags");

            migrationBuilder.CreateIndex(
                name: "IX_RfidTags_PropertyId_TagNumber",
                table: "RfidTags",
                columns: new[] { "PropertyId", "TagNumber" },
                unique: true,
                filter: "\"Status\" = 'active'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_RfidTags_PropertyId_TagNumber",
                table: "RfidTags");

            migrationBuilder.CreateIndex(
                name: "IX_RfidTags_PropertyId_TagNumber",
                table: "RfidTags",
                columns: new[] { "PropertyId", "TagNumber" },
                unique: true);
        }
    }
}
