using System;
using System.Threading;
using System.Threading.Tasks;
using Aquri.Application.Tickets;
using Aquri.Domain.Entities;
using Aquri.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Aquri.Tests.Tickets
{
    public class TicketHandlerTestBase : IDisposable
    {
        protected readonly AquriDbContext Context;
        protected int ReporterId;
        protected int AssigneeId;

        public TicketHandlerTestBase()
        {
            var options = new DbContextOptionsBuilder<AquriDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            Context = new AquriDbContext(options);
            Seed().GetAwaiter().GetResult();
        }

        private async Task Seed()
        {
            var reporter = new User("front@nexus.com", "Front Desk", "front_desk", "x");
            var assignee = new User("maint@nexus.com", "Maintenance", "maintenance", "x");
            Context.Users.AddRange(reporter, assignee);
            await Context.SaveChangesAsync();

            ReporterId = reporter.Id;
            AssigneeId = assignee.Id;
        }

        protected async Task<int> SeedTicket(string priority = "medium")
        {
            var created = await new CreateTicketHandler(Context, new NumberGenerator(Context)).Handle(
                new CreateTicketCommand(1, ReporterId, "AC broken", "Unit not cooling", "issue",
                    "maintenance", priority, null, null, null, System.Array.Empty<string>()),
                CancellationToken.None);
            return created.Data!.Id;
        }

        public void Dispose() => Context.Dispose();
    }

    public class CreateTicketHandler_Should : TicketHandlerTestBase
    {
        [Fact]
        public async Task Open_Ticket_With_Number()
        {
            var handler = new CreateTicketHandler(Context, new NumberGenerator(Context));
            var command = new CreateTicketCommand(1, ReporterId, "AC broken", "Unit not cooling", "issue",
                "maintenance", "high", null, null, null, new[] { "hvac" });

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data!.TicketNumber.Should().StartWith("TKT-");
            result.Data.Status.Should().Be("open");
            result.Data.Priority.Should().Be("high");
            result.Data.ReporterName.Should().Be("Front Desk");
            result.Data.Tags.Should().Contain("hvac");
        }

        [Fact]
        public async Task Fail_For_Unknown_Reporter()
        {
            var handler = new CreateTicketHandler(Context, new NumberGenerator(Context));
            var command = new CreateTicketCommand(1, 999, "Title", "Desc", "issue",
                "maintenance", "medium", null, null, null, System.Array.Empty<string>());

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Contain("Reporter not found");
        }
    }

    public class ChangeTicketStatusHandler_Should : TicketHandlerTestBase
    {
        [Fact]
        public async Task Transition_Open_To_InProgress()
        {
            var id = await SeedTicket();
            var handler = new ChangeTicketStatusHandler(Context);

            var result = await handler.Handle(new ChangeTicketStatusCommand(id, "in_progress"), CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data!.Status.Should().Be("in_progress");
        }

        [Fact]
        public async Task Reject_Illegal_Transition()
        {
            var id = await SeedTicket();
            var handler = new ChangeTicketStatusHandler(Context);

            var result = await handler.Handle(new ChangeTicketStatusCommand(id, "closed"), CancellationToken.None);

            result.Success.Should().BeFalse();
        }

        [Fact]
        public async Task Return_NotFound_For_Unknown_Ticket()
        {
            var handler = new ChangeTicketStatusHandler(Context);

            var result = await handler.Handle(new ChangeTicketStatusCommand(999, "in_progress"), CancellationToken.None);

            result.Success.Should().BeFalse();
            result.NotFound.Should().BeTrue();
        }
    }

    public class AssignTicketHandler_Should : TicketHandlerTestBase
    {
        [Fact]
        public async Task Assign_To_Staff_Member()
        {
            var id = await SeedTicket();
            var handler = new AssignTicketHandler(Context);

            var result = await handler.Handle(new AssignTicketCommand(id, AssigneeId), CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data!.AssigneeName.Should().Be("Maintenance");
        }

        [Fact]
        public async Task Fail_For_Unknown_Assignee()
        {
            var id = await SeedTicket();
            var handler = new AssignTicketHandler(Context);

            var result = await handler.Handle(new AssignTicketCommand(id, 999), CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Contain("Assignee not found");
        }
    }

    public class AddTicketCommentHandler_Should : TicketHandlerTestBase
    {
        [Fact]
        public async Task Append_Comment()
        {
            var id = await SeedTicket();
            var handler = new AddTicketCommentHandler(Context);

            var result = await handler.Handle(new AddTicketCommentCommand(id, ReporterId, "Checked the unit.", false), CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data!.Comments.Should().HaveCount(1);
            result.Data.Comments[0].Content.Should().Be("Checked the unit.");
        }
    }
}
