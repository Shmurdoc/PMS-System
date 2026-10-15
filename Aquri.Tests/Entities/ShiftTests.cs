using Aquri.Domain.Entities;
using Aquri.Domain.Exceptions;
using FluentAssertions;
using Xunit;

namespace Aquri.Tests.Entities
{
    public class ShiftTests
    {
        private static Shift NewShift() =>
            new(1, 2, "Sipho Dlamini", new DateTime(2026, 11, 1, 8, 0, 0), new DateTime(2026, 11, 1, 16, 0, 0), "front_desk");

        [Fact]
        public void Constructor_SetsDateFromStartTime()
        {
            var shift = NewShift();

            shift.Date.Should().Be(new DateTime(2026, 11, 1));
            shift.Status.Should().Be("scheduled");
        }

        [Fact]
        public void Constructor_EndBeforeStart_Throws()
        {
            var act = () => new Shift(1, 2, "Name", new DateTime(2026, 11, 1, 16, 0, 0), new DateTime(2026, 11, 1, 8, 0, 0), "role");

            act.Should().Throw<ArgumentException>();
        }

        [Fact]
        public void Swap_MovesShiftToNewStaff()
        {
            var shift = NewShift();

            shift.Swap("Naledi Khumalo");

            shift.UserName.Should().Be("Naledi Khumalo");
            shift.SwappedWith.Should().Be("Sipho Dlamini");
            shift.Status.Should().Be("swapped");
        }

        [Fact]
        public void Swap_CompletedShift_Throws()
        {
            var shift = NewShift();
            shift.ChangeStatus("completed");

            var act = () => shift.Swap("Someone Else");

            act.Should().Throw<DomainException>();
        }

        [Fact]
        public void RecordOvertime_Negative_Throws()
        {
            var shift = NewShift();

            var act = () => shift.RecordOvertime(-1m);

            act.Should().Throw<ArgumentException>();
        }

        [Fact]
        public void SetNotes_Trims_And_Empty_Becomes_Null()
        {
            var shift = NewShift();

            shift.SetNotes("  Covering lunch rush  ");
            shift.Notes.Should().Be("Covering lunch rush");

            shift.SetNotes("   ");
            shift.Notes.Should().BeNull();
        }

        [Fact]
        public void SetDepartment_Trims_And_Empty_Becomes_Null()
        {
            var shift = NewShift();

            shift.SetDepartment(" Front Office ");
            shift.Department.Should().Be("Front Office");

            shift.SetDepartment(null);
            shift.Department.Should().BeNull();
        }
    }
}
