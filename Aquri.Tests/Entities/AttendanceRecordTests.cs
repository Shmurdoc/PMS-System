using Aquri.Domain.Entities;
using Aquri.Domain.Exceptions;
using FluentAssertions;
using Xunit;

namespace Aquri.Tests.Entities
{
    public class AttendanceRecordTests
    {
        private static DateTime Day => new(2026, 11, 1);

        [Fact]
        public void ClockOut_ComputesHoursAndOvertime()
        {
            var record = new AttendanceRecord(1, 2, "Sipho", Day.AddHours(8));

            record.ClockOut(Day.AddHours(18)); // 10h total → 2h overtime past 8

            record.HoursWorked.Should().Be(10m);
            record.Overtime.Should().Be(2m);
        }

        [Fact]
        public void ClockOut_WithinEightHours_NoOvertime()
        {
            var record = new AttendanceRecord(1, 2, "Sipho", Day.AddHours(8));

            record.ClockOut(Day.AddHours(12));

            record.HoursWorked.Should().Be(4m);
            record.Overtime.Should().Be(0m);
        }

        [Fact]
        public void ClockOut_Twice_Throws()
        {
            var record = new AttendanceRecord(1, 2, "Sipho", Day.AddHours(8));
            record.ClockOut(Day.AddHours(16));

            var act = () => record.ClockOut(Day.AddHours(18));

            act.Should().Throw<DomainException>();
        }

        [Fact]
        public void ClockOut_BeforeCheckIn_Throws()
        {
            var record = new AttendanceRecord(1, 2, "Sipho", Day.AddHours(8));

            var act = () => record.ClockOut(Day.AddHours(7));

            act.Should().Throw<ArgumentException>();
        }

        [Fact]
        public void AbsentFactory_SetsStatus()
        {
            var record = AttendanceRecord.Absent(1, 2, "Sipho", Day);

            record.Status.Should().Be("absent");
            record.Date.Should().Be(Day);
        }

        [Fact]
        public void MarkLate_FromPresent_Then_Cannot_MarkLate_Again()
        {
            var record = new AttendanceRecord(1, 2, "Sipho", Day.AddHours(8));

            record.MarkLate();
            record.Status.Should().Be("late");

            var act = () => record.MarkLate();
            act.Should().Throw<DomainException>();
        }

        [Fact]
        public void MarkOnLeave_SetsStatusAndNotes()
        {
            var record = new AttendanceRecord(1, 2, "Sipho", Day.AddHours(8));

            record.MarkOnLeave("Family matter");

            record.Status.Should().Be("on_leave");
            record.Notes.Should().Be("Family matter");
        }

        [Fact]
        public void SetNotes_Trims_And_Empty_Becomes_Null()
        {
            var record = new AttendanceRecord(1, 2, "Sipho", Day.AddHours(8));

            record.SetNotes("  Late bus  ");
            record.Notes.Should().Be("Late bus");

            record.SetNotes(" ");
            record.Notes.Should().BeNull();
        }
    }
}
