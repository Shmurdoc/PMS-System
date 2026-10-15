using Aquri.Domain.Entities;
using Aquri.Domain.Enums;
using Aquri.Domain.Exceptions;
using FluentAssertions;
using Xunit;

namespace Aquri.Tests.Entities
{
    public class RfidTagTests
    {
        private static RfidTag NewStaffTag(string accessLevel = "front_desk") =>
            RfidTag.ForStaff(1, 7, "04A2B9C1", accessLevel);

        [Fact]
        public void ForStaff_Accepts_FreeForm_AccessLevel()
        {
            var tag = NewStaffTag("VIP Lounge 3");

            tag.AccessLevel.Should().Be("VIP Lounge 3");
        }

        [Fact]
        public void SetAccessLevel_Trims_Input()
        {
            var tag = NewStaffTag();

            tag.SetAccessLevel("  housekeeping  ");

            tag.AccessLevel.Should().Be("housekeeping");
        }

        [Fact]
        public void SetAccessLevel_Whitespace_Throws()
        {
            var tag = NewStaffTag();

            var act = () => tag.SetAccessLevel("   ");

            act.Should().Throw<ArgumentException>();
        }

        [Fact]
        public void SetAccessLevel_128_Chars_Accepts()
        {
            var tag = NewStaffTag();
            var level = new string('a', 128);

            tag.SetAccessLevel(level);

            tag.AccessLevel.Should().Be(level);
        }

        [Fact]
        public void SetAccessLevel_129_Chars_Throws()
        {
            var tag = NewStaffTag();

            var act = () => tag.SetAccessLevel(new string('a', 129));

            act.Should().Throw<ArgumentException>();
        }

        [Fact]
        public void ForGuest_Sets_Guest_Label()
        {
            var tag = RfidTag.ForGuest(1, 4, "04A2B9D2", new DateTime(2026, 10, 20, 11, 0, 0));

            tag.AccessLevel.Should().Be("guest");
        }

        [Fact]
        public void RecordUse_Taps_On_Expiry_Day_Allowed()
        {
            var tag = NewStaffTag();
            tag.SetExpiry(new DateTime(2026, 10, 15, 9, 0, 0));
            var laterThatDay = new DateTime(2026, 10, 15, 23, 59, 0);

            tag.RecordUse(laterThatDay);

            tag.LastUsed.Should().Be(laterThatDay);
        }

        [Fact]
        public void RecordUse_Day_After_Expiry_Throws()
        {
            var tag = NewStaffTag();
            tag.SetExpiry(new DateTime(2026, 10, 15, 9, 0, 0));

            var act = () => tag.RecordUse(new DateTime(2026, 10, 16, 0, 1, 0));

            act.Should().Throw<DomainException>().WithMessage("Tag has expired.");
        }

        [Fact]
        public void RecordUse_Inactive_Tag_Throws()
        {
            var tag = NewStaffTag();
            tag.ChangeStatus(RfidTagStatus.Lost);

            var act = () => tag.RecordUse(DateTime.UtcNow);

            act.Should().Throw<DomainException>().WithMessage("Tag is not active.");
        }

        [Fact]
        public void ChangeStatus_Reactivate_From_Active_Throws()
        {
            var tag = NewStaffTag();

            var act = () => tag.ChangeStatus(RfidTagStatus.Active);

            act.Should().Throw<DomainException>().WithMessage("Only inactive tags can be reactivated.");
        }

        [Fact]
        public void ChangeStatus_Revoke_From_Active_Allows()
        {
            var tag = NewStaffTag();

            tag.ChangeStatus(RfidTagStatus.Lost);

            tag.Status.Should().Be(RfidTagStatus.Lost);
        }

        [Fact]
        public void ChangeStatus_Restore_From_Inactive_Allows()
        {
            var tag = NewStaffTag();
            tag.ChangeStatus(RfidTagStatus.Inactive);

            tag.ChangeStatus(RfidTagStatus.Active);

            tag.Status.Should().Be(RfidTagStatus.Active);
        }

        [Fact]
        public void SetNotes_Trims_And_Collapses_Whitespace()
        {
            var tag = NewStaffTag();

            tag.SetNotes("  front desk spare  ");
            tag.Notes.Should().Be("front desk spare");

            tag.SetNotes("   ");
            tag.Notes.Should().BeNull();
        }
    }
}
