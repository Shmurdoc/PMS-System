using Aquri.Domain.Entities;
using FluentAssertions;
using Xunit;

namespace Aquri.Tests.Entities
{
    public class AuditLogTests
    {
        private static AuditLog NewLog() =>
            new(1, "change_status", "booking", "42", "Mokoena stay", 2, "Front Desk", "front_desk", "Booking checked in.");

        [Fact]
        public void Constructor_Valid_StampsTimestamp()
        {
            var log = NewLog();

            log.Action.Should().Be("change_status");
            log.EntityType.Should().Be("booking");
            log.Timestamp.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromMinutes(1));
        }

        [Fact]
        public void Constructor_UnknownEntityType_Throws()
        {
            var act = () => new AuditLog(1, "do_thing", "spaceship", "1", "X", 1, "User", "admin", "details");

            act.Should().Throw<ArgumentException>();
        }

        [Fact]
        public void RecordChange_StoresOldAndNew()
        {
            var log = NewLog();

            log.RecordChange("confirmed", "checked-in");

            log.OldValue.Should().Be("confirmed");
            log.NewValue.Should().Be("checked-in");
        }

        [Fact]
        public void Constructor_EmptyAction_Throws()
        {
            var act = () => new AuditLog(1, "", "booking", "1", "X", 1, "User", "admin", "details");

            act.Should().Throw<ArgumentException>();
        }

        [Fact]
        public void Constructor_Accepts_Payroll_Entity_Types()
        {
            // Payroll handlers write audit rows with these types; if they are
            // rejected, approve/pay/cancel 500s in production. The handler
            // tests do not exercise this path, so pin it here.
            var act = () => new AuditLog(1, "approve_payroll_run", "payroll_run", "7", "R2026-10", 1, "Admin", "admin", "Approved.");

            act.Should().NotThrow();
        }
    }
}
