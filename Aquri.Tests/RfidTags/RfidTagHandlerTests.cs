using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Aquri.Application.RfidTags;
using Aquri.Domain.Entities;
using Aquri.Domain.Enums;
using Aquri.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Aquri.Tests.RfidTags
{
    /// <summary>
    /// In-memory harness for the RFID handlers — real AquriDbContext, no
    /// AutoMapper (the tag DTOs map themselves).
    /// </summary>
    public class RfidTagTestBase : IDisposable
    {
        protected readonly AquriDbContext Context;

        public RfidTagTestBase()
        {
            var options = new DbContextOptionsBuilder<AquriDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            Context = new AquriDbContext(options);

            // Tenant 1 must exist before any handler issues a tag there.
            Context.Properties.Add(new Property("Test Hotel", 1));
            Context.SaveChanges();
        }

        public void Dispose() => Context.Dispose();

        protected async Task<User> SeedUser(string name = "Night Nurse", string role = "front_desk")
        {
            var user = new User($"{Guid.NewGuid():N}@aquri.test", name, role, "hash");
            Context.Users.Add(user);
            await Context.SaveChangesAsync();
            return user;
        }

        protected async Task<Booking> SeedBooking(DateTime? checkOut = null)
        {
            const int propertyId = 1;
            if (!await Context.Properties.AnyAsync(p => p.PropertyId == propertyId))
            {
                Context.Properties.Add(new Property("Test Hotel", propertyId));
                await Context.SaveChangesAsync();
            }

            var guest = new Guest("Ada Lovelace", "ada@a.test", "+15550001", "P123", "UK");
            Context.Guests.Add(guest);
            await Context.SaveChangesAsync();

            var room = new Room("101", propertyId, "double");
            Context.Rooms.Add(room);
            await Context.SaveChangesAsync();

            var checkIn = DateTime.UtcNow.Date.AddDays(1);
            var booking = new Booking(
                propertyId, guest.Id, room.Id,
                checkIn, checkOut ?? checkIn.AddDays(2),
                2, 150m, "direct");
            Context.Bookings.Add(booking);
            await Context.SaveChangesAsync();
            return booking;
        }
    }

    public class IssueRfidTagHandler_Should : RfidTagTestBase
    {
        [Fact]
        public async Task Issue_Staff_Tag_Bound_To_User()
        {
            var user = await SeedUser();
            var handler = new IssueRfidTagHandler(Context);

            var result = await handler.Handle(new IssueRfidTagCommand(
                1, "staff", "UID-001", user.Id, null, "housekeeping", null, null),
                CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data!.Kind.Should().Be("staff");
            result.Data.UserId.Should().Be(user.Id);
            result.Data.BookingId.Should().BeNull();
            result.Data.UserName.Should().Be("Night Nurse");
            result.Data.Status.Should().Be("active");

            var tag = Context.RfidTags.Single();
            tag.BookingId.Should().BeNull();
        }

        [Fact]
        public async Task Issue_Guest_Tag_Defaulting_Expiry_To_Checkout()
        {
            var booking = await SeedBooking();
            var handler = new IssueRfidTagHandler(Context);

            var result = await handler.Handle(new IssueRfidTagCommand(
                1, "guest", "UID-002", null, booking.Id, null, null, "sea view"),
                CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data!.Kind.Should().Be("guest");
            result.Data.BookingId.Should().Be(booking.Id);
            result.Data.UserId.Should().BeNull();
            result.Data.ExpiresAt.Should().Be(booking.CheckOut);
            result.Data.GuestName.Should().Be("Ada Lovelace");
            result.Data.RoomNumber.Should().Be("101");
        }

        [Fact]
        public async Task Reject_Duplicate_Tag_Number_At_Same_Property()
        {
            var user = await SeedUser();
            var handler = new IssueRfidTagHandler(Context);

            var first = await handler.Handle(new IssueRfidTagCommand(
                1, "staff", "UID-DUP", user.Id, null, null, null, null),
                CancellationToken.None);
            var second = await handler.Handle(new IssueRfidTagCommand(
                1, "staff", "UID-DUP", user.Id, null, null, null, null),
                CancellationToken.None);

            first.Success.Should().BeTrue();
            second.Success.Should().BeFalse();
            second.Conflict.Should().BeTrue();
            Context.RfidTags.Should().HaveCount(1);
        }

        [Fact]
        public async Task Reject_Unknown_Kind_And_Missing_Binding()
        {
            var handler = new IssueRfidTagHandler(Context);

            var badKind = await handler.Handle(new IssueRfidTagCommand(
                1, "visitor", "UID-003", null, null, null, null, null),
                CancellationToken.None);
            var missingUser = await handler.Handle(new IssueRfidTagCommand(
                1, "staff", "UID-004", null, null, null, null, null),
                CancellationToken.None);

            badKind.Success.Should().BeFalse();
            missingUser.Success.Should().BeFalse();
            Context.RfidTags.Should().BeEmpty();
        }

        [Fact]
        public async Task Reject_Staff_Tag_Bound_To_A_Booking()
        {
            var user = await SeedUser();
            var booking = await SeedBooking();
            var handler = new IssueRfidTagHandler(Context);

            var result = await handler.Handle(new IssueRfidTagCommand(
                1, "staff", "UID-XBIND", user.Id, booking.Id, null, null, null),
                CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Contain("staff tag cannot be bound to a booking");
            Context.RfidTags.Should().BeEmpty();
        }

        [Fact]
        public async Task Reject_Guest_Tag_Bound_To_A_User()
        {
            var user = await SeedUser();
            var booking = await SeedBooking();
            var handler = new IssueRfidTagHandler(Context);

            var result = await handler.Handle(new IssueRfidTagCommand(
                1, "guest", "UID-XBIND", user.Id, booking.Id, null, null, null),
                CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Contain("guest tag cannot be bound to a user");
            Context.RfidTags.Should().BeEmpty();
        }

        [Fact]
        public async Task Wire_Staff_Expiry_Date_Through_Issue()
        {
            var user = await SeedUser();
            var handler = new IssueRfidTagHandler(Context);
            var expires = DateTime.UtcNow.Date.AddDays(30);

            var result = await handler.Handle(new IssueRfidTagCommand(
                1, "staff", "UID-EXPS", user.Id, null, "housekeeping", expires, null),
                CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data!.ExpiresAt.Should().Be(expires);
        }

        [Fact]
        public async Task Reject_Issue_For_Unknown_Property()
        {
            var user = await SeedUser();
            var handler = new IssueRfidTagHandler(Context);

            var result = await handler.Handle(new IssueRfidTagCommand(
                4242, "staff", "UID-PROP", user.Id, null, null, null, null),
                CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Contain("not found");
            Context.RfidTags.Should().BeEmpty();
        }

        [Fact]
        public async Task Reject_Tag_Number_Over_64_Characters()
        {
            var user = await SeedUser();
            var handler = new IssueRfidTagHandler(Context);

            var result = await handler.Handle(new IssueRfidTagCommand(
                1, "staff", new string('X', 65), user.Id, null, null, null, null),
                CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Contain("64");
            Context.RfidTags.Should().BeEmpty();
        }

        [Fact]
        public async Task Reject_Notes_Over_2000_Characters()
        {
            var user = await SeedUser();
            var handler = new IssueRfidTagHandler(Context);

            var result = await handler.Handle(new IssueRfidTagCommand(
                1, "staff", "UID-LONG", user.Id, null, null, null, new string('n', 2001)),
                CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Contain("2000");
            Context.RfidTags.Should().BeEmpty();
        }

        [Fact]
        public async Task Reject_Guest_Tag_For_Booking_At_Another_Property()
        {
            var booking = await SeedBooking();
            Context.Properties.Add(new Property("Other Hotel", 2));
            await Context.SaveChangesAsync();
            var handler = new IssueRfidTagHandler(Context);

            var result = await handler.Handle(new IssueRfidTagCommand(
                2, "guest", "UID-005", null, booking.Id, null, null, null),
                CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Contain("different property");
        }
    }

    public class RevokeRfidTagHandler_Should : RfidTagTestBase
    {
        [Fact]
        public async Task Block_Tag_And_Refuse_Double_Revoke()
        {
            var user = await SeedUser();
            var issue = new IssueRfidTagHandler(Context);
            var created = await issue.Handle(new IssueRfidTagCommand(
                1, "staff", "UID-REVOKE", user.Id, null, null, null, null),
                CancellationToken.None);

            var handler = new RevokeRfidTagHandler(Context);
            var revoked = await handler.Handle(
                new RevokeRfidTagCommand(created.Data!.Id, "lost at pool"),
                CancellationToken.None);
            var again = await handler.Handle(
                new RevokeRfidTagCommand(created.Data.Id, null),
                CancellationToken.None);

            revoked.Success.Should().BeTrue();
            revoked.Data!.Status.Should().Be("blocked");
            revoked.Data.Notes.Should().Be("lost at pool");
            again.Success.Should().BeFalse();
            again.Conflict.Should().BeTrue();
        }

        [Fact]
        public async Task Return_NotFound_For_Unknown_Tag()
        {
            var handler = new RevokeRfidTagHandler(Context);

            var result = await handler.Handle(new RevokeRfidTagCommand(4242, null),
                CancellationToken.None);

            result.NotFound.Should().BeTrue();
        }
    }

    public class RecordStaffTapHandler_Should : RfidTagTestBase
    {
        private async Task<int> SeedStaffTag(int? propertyId = null)
        {
            var user = await SeedUser();
            var issue = new IssueRfidTagHandler(Context);
            var created = await issue.Handle(new IssueRfidTagCommand(
                propertyId ?? 1, "staff", "UID-TAP", user.Id, null, null, null, null),
                CancellationToken.None);
            return created.Data!.Id;
        }

        [Fact]
        public async Task Toggle_Attendance_In_Then_Out_Same_Day()
        {
            var tagId = await SeedStaffTag();
            var handler = new RecordStaffTapHandler(Context);
            var clockIn = DateTime.UtcNow.Date.AddHours(9);
            var clockOut = clockIn.AddHours(8);

            var first = await handler.Handle(
                new RecordStaffTapCommand(1, "UID-TAP", clockIn), CancellationToken.None);
            var second = await handler.Handle(
                new RecordStaffTapCommand(1, "UID-TAP", clockOut), CancellationToken.None);

            first.Success.Should().BeTrue();
            first.Data!.Punch.Should().Be("in");
            first.Data.CheckOut.Should().BeNull();

            second.Success.Should().BeTrue();
            second.Data!.Punch.Should().Be("out");
            second.Data.CheckIn.Should().Be(clockIn);
            second.Data.CheckOut.Should().Be(clockOut);
            second.Data.AttendanceId.Should().Be(first.Data.AttendanceId);

            var record = Context.AttendanceRecords.Single();
            record.HoursWorked.Should().Be(8m);

            var tag = Context.RfidTags.Single(t => t.Id == tagId);
            tag.LastUsed.Should().Be(clockOut);
        }

        [Fact]
        public async Task Reject_Guest_Tag_And_Unknown_Tag()
        {
            var booking = await SeedBooking();
            var issue = new IssueRfidTagHandler(Context);
            await issue.Handle(new IssueRfidTagCommand(
                1, "guest", "UID-GUEST", null, booking.Id, null, null, null),
                CancellationToken.None);

            var handler = new RecordStaffTapHandler(Context);
            var wrongKind = await handler.Handle(
                new RecordStaffTapCommand(1, "UID-GUEST", null), CancellationToken.None);
            var unknown = await handler.Handle(
                new RecordStaffTapCommand(1, "UID-NOPE", null), CancellationToken.None);

            wrongKind.Success.Should().BeFalse();
            wrongKind.Error.Should().Contain("not a staff badge");
            unknown.NotFound.Should().BeTrue();
            Context.AttendanceRecords.Should().BeEmpty();
        }

        [Fact]
        public async Task Reject_Blocked_Tag_Before_Touching_Attendance()
        {
            var tagId = await SeedStaffTag();
            var tag = Context.RfidTags.Single(t => t.Id == tagId);
            tag.ChangeStatus(RfidTagStatus.Blocked);
            await Context.SaveChangesAsync();

            var handler = new RecordStaffTapHandler(Context);
            var result = await handler.Handle(
                new RecordStaffTapCommand(1, "UID-TAP", null), CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Contain("not active");
            Context.AttendanceRecords.Should().BeEmpty();
        }

        [Fact]
        public async Task Repeat_Tap_Within_3s_Reports_Without_Toggling()
        {
            await SeedStaffTag();
            var handler = new RecordStaffTapHandler(Context);
            var clockIn = DateTime.UtcNow.Date.AddHours(9);

            var first = await handler.Handle(
                new RecordStaffTapCommand(1, "UID-TAP", clockIn), CancellationToken.None);
            var replay = await handler.Handle(
                new RecordStaffTapCommand(1, "UID-TAP", clockIn.AddSeconds(1)), CancellationToken.None);
            var later = await handler.Handle(
                new RecordStaffTapCommand(1, "UID-TAP", clockIn.AddSeconds(5)), CancellationToken.None);

            first.Data!.Punch.Should().Be("in");
            replay.Success.Should().BeTrue();
            replay.Data!.Punch.Should().Be("in");
            replay.Data.AttendanceId.Should().Be(first.Data.AttendanceId);
            replay.Data.CheckOut.Should().BeNull();

            later.Success.Should().BeTrue();
            later.Data!.Punch.Should().Be("out");
            later.Data.AttendanceId.Should().Be(first.Data.AttendanceId);

            var record = Context.AttendanceRecords.Single();
            record.CheckOut.Should().Be(clockIn.AddSeconds(5));
        }

        [Fact]
        public async Task Reject_Tap_At_Another_Property()
        {
            await SeedStaffTag();
            var handler = new RecordStaffTapHandler(Context);

            var result = await handler.Handle(
                new RecordStaffTapCommand(2, "UID-TAP", null), CancellationToken.None);

            result.NotFound.Should().BeTrue();
            Context.AttendanceRecords.Should().BeEmpty();
        }

        [Fact]
        public async Task Reject_Tap_When_Badge_User_Is_Gone()
        {
            await SeedStaffTag();
            Context.Users.RemoveRange(Context.Users);
            await Context.SaveChangesAsync();

            var handler = new RecordStaffTapHandler(Context);
            var result = await handler.Handle(
                new RecordStaffTapCommand(1, "UID-TAP", null), CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Contain("no longer exists");
            Context.AttendanceRecords.Should().BeEmpty();
        }

        [Fact]
        public async Task Reject_Inactive_Tag_Tap()
        {
            var tagId = await SeedStaffTag();
            var tag = Context.RfidTags.Single(t => t.Id == tagId);
            tag.ChangeStatus(RfidTagStatus.Inactive);
            await Context.SaveChangesAsync();

            var handler = new RecordStaffTapHandler(Context);
            var result = await handler.Handle(
                new RecordStaffTapCommand(1, "UID-TAP", null), CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Contain("not active");
            Context.AttendanceRecords.Should().BeEmpty();
        }
    }

    public class ResolveGuestTapHandler_Should : RfidTagTestBase
    {
        [Fact]
        public async Task Return_Booking_Context_And_Write_Nothing_To_It()
        {
            var booking = await SeedBooking();
            var issue = new IssueRfidTagHandler(Context);
            await issue.Handle(new IssueRfidTagCommand(
                1, "guest", "UID-CTX", null, booking.Id, null, null, null),
                CancellationToken.None);

            var attendanceBefore = Context.AttendanceRecords.Count();
            var bookingBefore = Context.Bookings.AsNoTracking()
                .Single(b => b.Id == booking.Id).LastModified;

            var handler = new ResolveGuestTapHandler(Context);
            var result = await handler.Handle(
                new ResolveGuestTapCommand(1, "UID-CTX", null), CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data!.GuestName.Should().Be("Ada Lovelace");
            result.Data.RoomNumber.Should().Be("101");
            result.Data.BookingId.Should().Be(booking.Id);
            result.Data.BookingStatus.Should().NotBeNullOrEmpty();

            Context.AttendanceRecords.Count().Should().Be(attendanceBefore);
            var bookingAfter = Context.Bookings.AsNoTracking()
                .Single(b => b.Id == booking.Id);
            bookingAfter.LastModified.Should().Be(bookingBefore);
            bookingAfter.Status.Should().Be(booking.Status);
        }

        [Fact]
        public async Task Reject_Staff_Tag_And_Unknown_Tag()
        {
            var user = await SeedUser();
            var issue = new IssueRfidTagHandler(Context);
            await issue.Handle(new IssueRfidTagCommand(
                1, "staff", "UID-BADGE", user.Id, null, null, null, null),
                CancellationToken.None);

            var handler = new ResolveGuestTapHandler(Context);
            var wrongKind = await handler.Handle(
                new ResolveGuestTapCommand(1, "UID-BADGE", null), CancellationToken.None);
            var unknown = await handler.Handle(
                new ResolveGuestTapCommand(1, "UID-NOPE", null), CancellationToken.None);

            wrongKind.Success.Should().BeFalse();
            wrongKind.Error.Should().Contain("not a guest tag");
            unknown.NotFound.Should().BeTrue();
        }

        [Fact]
        public async Task Reject_Expired_Tag()
        {
            var booking = await SeedBooking();
            var issue = new IssueRfidTagHandler(Context);
            await issue.Handle(new IssueRfidTagCommand(
                1, "guest", "UID-EXP", null, booking.Id, null,
                DateTime.UtcNow.AddDays(-1), null), CancellationToken.None);

            var handler = new ResolveGuestTapHandler(Context);
            var result = await handler.Handle(
                new ResolveGuestTapCommand(1, "UID-EXP", null), CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Contain("expired");
        }
    }

    public class GetRfidTagsHandler_Should : RfidTagTestBase
    {
        [Fact]
        public async Task List_Tags_For_Property_With_Resolved_Names()
        {
            var user = await SeedUser();
            var booking = await SeedBooking();
            var issue = new IssueRfidTagHandler(Context);
            await issue.Handle(new IssueRfidTagCommand(
                1, "staff", "UID-L1", user.Id, null, null, null, null),
                CancellationToken.None);
            await issue.Handle(new IssueRfidTagCommand(
                1, "guest", "UID-L2", null, booking.Id, null, null, null),
                CancellationToken.None);

            var handler = new GetRfidTagsHandler(Context);
            var all = await handler.Handle(new GetRfidTagsQuery(1, null), CancellationToken.None);
            var staffOnly = await handler.Handle(new GetRfidTagsQuery(1, "staff"), CancellationToken.None);
            var otherProperty = await handler.Handle(new GetRfidTagsQuery(99, null), CancellationToken.None);

            all.Should().HaveCount(2);
            all.Single(t => t.Kind == "staff").UserName.Should().Be("Night Nurse");
            all.Single(t => t.Kind == "guest").GuestName.Should().Be("Ada Lovelace");
            staffOnly.Should().ContainSingle().Which.Kind.Should().Be("staff");
            otherProperty.Should().BeEmpty();
        }

        [Fact]
        public async Task Return_Empty_List_For_Unknown_Kind()
        {
            var user = await SeedUser();
            var issue = new IssueRfidTagHandler(Context);
            await issue.Handle(new IssueRfidTagCommand(
                1, "staff", "UID-K1", user.Id, null, null, null, null),
                CancellationToken.None);

            var handler = new GetRfidTagsHandler(Context);
            var invalid = await handler.Handle(new GetRfidTagsQuery(1, "visitor"), CancellationToken.None);
            var blank = await handler.Handle(new GetRfidTagsQuery(1, "  "), CancellationToken.None);
            var valid = await handler.Handle(new GetRfidTagsQuery(1, "staff"), CancellationToken.None);

            invalid.Should().BeEmpty();
            blank.Should().HaveCount(1);
            valid.Should().HaveCount(1);
        }
    }
}
