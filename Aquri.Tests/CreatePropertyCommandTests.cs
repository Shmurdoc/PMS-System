using System.Threading;
using System.Threading.Tasks;
using Aquri.Application.DTOs;
using Aquri.Application.MappingProfiles;
using Aquri.Application.Properties.Commands;
using Aquri.Infrastructure.Persistence;
using AutoMapper;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Aquri.Tests
{
    /// <summary>In-memory test harness for CreatePropertyHandler. Uses a real AquriDbContext (InMemory) + real MappingProfile so the EF change-tracking and mapping paths are exercised end-to-end.</summary>
    public class CreatePropertyCommandHandler_Should : IDisposable
    {
        private readonly AquriDbContext _context;
        private readonly IMapper _mapper;
        private readonly CreatePropertyHandler _handler;

        public CreatePropertyCommandHandler_Should()
        {
            var options = new DbContextOptionsBuilder<AquriDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            _context = new AquriDbContext(options);

            var config = new MapperConfiguration(cfg => cfg.AddProfile<MappingProfile>());
            _mapper = config.CreateMapper();

            _handler = new CreatePropertyHandler(_context, _mapper);
        }

        public void Dispose() => _context.Dispose();

        [Fact]
        public async Task Return_Property_Dto_When_Valid_Command()
        {
            var command = new CreatePropertyCommand { Name = "Test Property", PropertyId = 1 };

            var result = await _handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeTrue();
            result.NotFound.Should().BeFalse();
            result.Data.Should().NotBeNull();
            result.Data!.Name.Should().Be("Test Property");
            result.Data.PropertyId.Should().Be(1);
        }

        [Fact]
        public async Task Persist_New_Property_To_Database()
        {
            var command = new CreatePropertyCommand { Name = "Persisted Villa", PropertyId = 7 };

            await _handler.Handle(command, CancellationToken.None);

            var saved = await _context.Properties.SingleAsync();
            saved.Name.Should().Be("Persisted Villa");
            saved.PropertyId.Should().Be(7);
            saved.Id.Should().BeGreaterThan(0);
        }

        [Fact]
        public async Task Return_Failure_When_Duplicate_PropertyId_Exists()
        {
            _context.Properties.Add(new Domain.Entities.Property("Original", 1));
            await _context.SaveChangesAsync();

            var command = new CreatePropertyCommand { Name = "Duplicate", PropertyId = 1 };

            var result = await _handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Contain("already exists");
            (await _context.Properties.CountAsync()).Should().Be(1);
        }

        [Fact]
        public async Task Return_Failure_When_Name_Empty()
        {
            var command = new CreatePropertyCommand { Name = "   ", PropertyId = 2 };

            var result = await _handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().NotBeNullOrEmpty();
            (await _context.Properties.CountAsync()).Should().Be(0);
        }

        [Fact]
        public async Task Return_Failure_When_PropertyId_Not_Positive()
        {
            var command = new CreatePropertyCommand { Name = "Valid Name", PropertyId = 0 };

            var result = await _handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().NotBeNullOrEmpty();
            (await _context.Properties.CountAsync()).Should().Be(0);
        }
    }
}
