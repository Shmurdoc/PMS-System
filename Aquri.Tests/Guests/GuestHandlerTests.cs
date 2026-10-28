using System;
using System.Threading;
using System.Threading.Tasks;
using Aquri.Application.Common.Interfaces;
using Aquri.Application.Guests;
using Aquri.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Aquri.Tests.Guests
{
    public class GuestHandlerTestBase : IDisposable
    {
        protected readonly AquriDbContext Context;
        protected readonly ICurrentUser CurrentUser = new FakeCurrentUser();

        public GuestHandlerTestBase()
        {
            var options = new DbContextOptionsBuilder<AquriDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            Context = new AquriDbContext(options);
        }

        public void Dispose() => Context.Dispose();
    }

    public class CreateGuestHandler_Should : GuestHandlerTestBase
    {
        [Fact]
        public async Task Create_Guest_And_Return_Dto()
        {
            var handler = new CreateGuestHandler(Context);
            var command = new CreateGuestCommand("Jane Doe", "jane@mail.com", "0820000000", "9001015800089", "South African", PropertyId: 1);

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data.Should().NotBeNull();
            result.Data!.Name.Should().Be("Jane Doe");
            result.Data.Email.Should().Be("jane@mail.com");
            result.Data.Nationality.Should().Be("South African");
            result.Data.Id.Should().BeGreaterThan(0);
        }

        [Fact]
        public async Task Fail_On_Empty_Name()
        {
            var handler = new CreateGuestHandler(Context);
            var command = new CreateGuestCommand("", "jane@mail.com", "0820000000", "9001015800089", "South African", PropertyId: 1);

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().NotBeNullOrWhiteSpace();
        }
    }

    public class UpdateGuestHandler_Should : GuestHandlerTestBase
    {
        [Fact]
        public async Task Update_Existing_Guest()
        {
            var created = await new CreateGuestHandler(Context).Handle(
                new CreateGuestCommand("Jane Doe", "jane@mail.com", "0820000000", "9001015800089", "South African", PropertyId: 1),
                CancellationToken.None);

            var handler = new UpdateGuestHandler(Context);
            var command = new UpdateGuestCommand(
                created.Data!.Id, "Jane Smith", "0821111111", "South African",
                "12 Long St", "John Doe", "0822222222", "Prefers late checkout", "gold");

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data!.Name.Should().Be("Jane Smith");
            result.Data.Phone.Should().Be("0821111111");
            result.Data.VipLevel.Should().Be("gold");
        }

        [Fact]
        public async Task Return_NotFound_For_Unknown_Guest()
        {
            var handler = new UpdateGuestHandler(Context);
            var command = new UpdateGuestCommand(999, "Jane", "082", "SA", null, null, null, "", null);

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeFalse();
            result.NotFound.Should().BeTrue();
        }
    }

    public class GetGuestsHandler_Should : GuestHandlerTestBase
    {
        [Fact]
        public async Task Filter_By_Search_Term()
        {
            await new CreateGuestHandler(Context).Handle(
                new CreateGuestCommand("Jane Doe", "jane@mail.com", "0820000000", "9001015800089", "SA", PropertyId: 1), CancellationToken.None);
            await new CreateGuestHandler(Context).Handle(
                new CreateGuestCommand("John Roe", "john@mail.com", "0830000000", "8502025800080", "SA", PropertyId: 1), CancellationToken.None);

            var handler = new GetGuestsHandler(Context, CurrentUser);

            var result = await handler.Handle(new GetGuestsQuery("jane"), CancellationToken.None);

            result.Should().HaveCount(1);
            result[0].Name.Should().Be("Jane Doe");
        }
    }

    sealed class FakeCurrentUser : ICurrentUser
    {
        public bool IsAuthenticated => true;
        public int? PropertyId => 1;
        public int UserId => 1;
        public string UserName => "test-user";
        public string UserRole => "admin";
    }
}
