using Aquri.Domain.Entities;
using Aquri.Domain.Enums;
using Aquri.Domain.Exceptions;
using FluentAssertions;
using Xunit;

namespace Aquri.Tests.Entities
{
    public class TicketTests
    {
        private static Ticket NewTicket(TicketPriority priority = TicketPriority.Medium) =>
            new("TKT-2026-00001", "AC broken in 214", "Guest reports no cold air.",
                TicketType.Issue, "maintenance", priority, 1, 2, "Front Desk");

        [Fact]
        public void Constructor_OpenStatus_WithReporter()
        {
            var ticket = NewTicket();

            ticket.Status.Should().Be(TicketStatus.Open);
            ticket.ReporterId.Should().Be(2);
            ticket.ReporterName.Should().Be("Front Desk");
            ticket.TicketNumber.Should().Be("TKT-2026-00001");
        }

        [Fact]
        public void Constructor_UnknownCategory_Throws()
        {
            var act = () => new Ticket("TKT-1", "Title", "Desc", TicketType.Issue, "nonsense", TicketPriority.Low, 1, 1, "User");

            act.Should().Throw<ArgumentException>();
        }

        [Fact]
        public void ChangeStatus_OpenToInProgress_Succeeds()
        {
            var ticket = NewTicket();

            ticket.ChangeStatus(TicketStatus.InProgress);

            ticket.Status.Should().Be(TicketStatus.InProgress);
        }

        [Fact]
        public void ChangeStatus_OpenToClosed_Throws()
        {
            var ticket = NewTicket();

            var act = () => ticket.ChangeStatus(TicketStatus.Closed);

            act.Should().Throw<DomainException>();
        }

        [Fact]
        public void ChangeStatus_Resolve_StampsResolvedAt()
        {
            var ticket = NewTicket();
            ticket.ChangeStatus(TicketStatus.Resolved);

            ticket.ResolvedAt.Should().NotBeNull();
        }

        [Fact]
        public void ChangeStatus_Close_StampsClosedAt()
        {
            var ticket = NewTicket();
            ticket.ChangeStatus(TicketStatus.Resolved);
            ticket.ChangeStatus(TicketStatus.Closed);

            ticket.ClosedAt.Should().NotBeNull();
        }

        [Fact]
        public void Assign_SetsAssignee()
        {
            var ticket = NewTicket();

            ticket.Assign(7, "Sipho Dlamini");

            ticket.AssigneeId.Should().Be(7);
            ticket.AssigneeName.Should().Be("Sipho Dlamini");
        }

        [Fact]
        public void ChangePriority_Valid_Sets()
        {
            var ticket = NewTicket();

            ticket.ChangePriority(TicketPriority.Urgent);

            ticket.Priority.Should().Be(TicketPriority.Urgent);
        }

        [Fact]
        public void AddComment_AppendsToComments()
        {
            var ticket = NewTicket();

            // The ticket isn't persisted, so its Id is still 0; the comment
            // needs a positive TicketId, which EF will set on insert.
            ticket.AddComment(new TicketComment(1, 2, "Front Desk", "Logged with maintenance.", false));

            ticket.Comments.Should().HaveCount(1);
            ticket.Comments.First().Content.Should().Be("Logged with maintenance.");
        }

        [Fact]
        public void AddTag_IgnoresDuplicates()
        {
            var ticket = NewTicket();

            ticket.AddTag("summer");
            ticket.AddTag("summer");

            ticket.Tags.Should().ContainSingle().Which.Should().Be("summer");
        }
    }
}
