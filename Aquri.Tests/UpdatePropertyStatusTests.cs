using System.Threading;
using System.Threading.Tasks;
using Aquri.Application.Common.Interfaces;
using Aquri.Application.DTOs;
using Aquri.Application.MappingProfiles;
using Aquri.Application.Properties.Status;
using Aquri.Domain.Entities;
using Aquri.Domain.Enums;
using Aquri.Infrastructure.Persistence;
using AutoMapper;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using Aquri.Tests.Common;

namespace Aquri.Tests
{
    /// <summary>In-memory test harness for UpdatePropertyStatusHandler. Exercises the real EF Core lookup-by-primary-key + status update path.</summary>
    public class UpdatePropertyStatusCommandHandler_Should : IDisposable
    {
        private readonly AquriDbContext _context;
        private readonly IMapper _mapper;
        private readonly ICurrentUser CurrentUser = new FakeCurrentUser();
        private readonly UpdatePropertyStatusHandler _handler;

        public UpdatePropertyStatusCommandHandler_Should()
        {
            var options = new DbContextOptionsBuilder<AquriDbContext>()
                .ReplaceService<Microsoft.EntityFrameworkCore.Infrastructure.IModelCacheKeyFactory, Aquri.Infrastructure.Persistence.PropertyScopeModelCacheKeyFactory>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            _context = new AquriDbContext(options);

            var config = new MapperConfiguration(cfg => cfg.AddProfile<MappingProfile>());
            _mapper = config.CreateMapper();

            _handler = new UpdatePropertyStatusHandler(_context, _mapper, CurrentUser);
        }

        public void Dispose() => _context.Dispose();

        [Fact]
        public async Task Update_Status_When_Valid_Command()
        {
            var existing = new Property("Seaside Villa", 1);
            _context.Properties.Add(existing);
            await _context.SaveChangesAsync();

            var command = new UpdatePropertyStatusCommand { Id = existing.Id, Status = PropertyStatus.Maintenance };

            var result = await _handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeTrue();
            result.NotFound.Should().BeFalse();
            result.Data.Should().NotBeNull();
            result.Data!.Status.Should().Be("maintenance");
        }

        [Fact]
        public async Task Persist_Status_Change_To_Database()
        {
            var existing = new Property("Seaside Villa", 1);
            _context.Properties.Add(existing);
            await _context.SaveChangesAsync();

            var command = new UpdatePropertyStatusCommand { Id = existing.Id, Status = PropertyStatus.Retired };

            await _handler.Handle(command, CancellationToken.None);

            var reloaded = await _context.Properties.SingleAsync();
            reloaded.Status.Should().Be(PropertyStatus.Retired);
        }

        [Fact]
        public async Task Return_NotFound_When_Property_Does_Not_Exist()
        {
            var command = new UpdatePropertyStatusCommand { Id = 999, Status = PropertyStatus.Maintenance };

            var result = await _handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeFalse();
            result.NotFound.Should().BeTrue();
            result.Data.Should().BeNull();
        }
    }
}
