using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Aquri.Application.Common.Interfaces;
using Aquri.Application.DTOs;
using Aquri.Application.MappingProfiles;
using Aquri.Application.Rooms.Commands;
using Aquri.Application.Rooms.Handlers;
using Aquri.Application.Rooms.Queries;
using Aquri.Application.Properties.Commands;
using Aquri.Application.Properties.Queries;
using Aquri.Domain.Entities;
using Aquri.Infrastructure.Persistence;
using AutoMapper;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using Aquri.Tests.Common;

namespace Aquri.Tests.Rooms
{
    /// <summary>In-memory test harness for Room handlers. Uses a real AquriDbContext (InMemory provider) + real AutoMapper MappingProfile so tests exercise the actual EF Core change-tracking + mapping paths.</summary>
    public class RoomHandlerTestBase : IDisposable
    {
        protected readonly AquriDbContext Context;
        protected readonly IMapper Mapper;
        protected readonly ICurrentUser CurrentUser = new FakeCurrentUser();

        public RoomHandlerTestBase()
        {
            var options = new DbContextOptionsBuilder<AquriDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            Context = new AquriDbContext(options);

            var config = new MapperConfiguration(cfg => cfg.AddProfile<MappingProfile>());
            Mapper = config.CreateMapper();
        }

        public void Dispose()
        {
            Context.Dispose();
        }
    }

    public class CreateRoomHandler_Should : RoomHandlerTestBase
    {
        [Fact]
        public async Task Create_Room_And_Return_Dto()
        {
            // Arrange
            Context.Properties.Add(new Property("Test Hotel", 1));
            await Context.SaveChangesAsync();

            var handler = new CreateRoomHandler(Context, Mapper);
            var command = new CreateRoomCommand
            {
                Number = "101",
                Type = "double",
                PropertyId = 1,
                BedType = "king",
                View = "ocean",
                Price = 199.99m,
                MaxOccupancy = 2,
                Size = 35,
                Floor = 1,
                Description = "Luxury ocean view",
                Amenities = new[] { "wifi", "minibar" }
            };

            // Act
            var result = await handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            result.Data.Should().NotBeNull();
            result.Data!.Number.Should().Be("101");
            result.Data.Type.Should().Be("double");
            result.Data.PropertyId.Should().Be(1);
            result.Data.BedType.Should().Be("king");
            result.Data.View.Should().Be("ocean");
            result.Data.Price.Should().Be(199.99m);
            result.Data.MaxOccupancy.Should().Be(2);
            result.Data.Size.Should().Be(35);
            result.Data.Floor.Should().Be(1);
            result.Data.Status.Should().Be("available");
            result.Data.Amenities.Should().BeEquivalentTo(new[] { "wifi", "minibar" });

            Context.Rooms.Should().HaveCount(1);
        }

        [Fact]
        public async Task Return_Failure_When_Property_Not_Found()
        {
            var handler = new CreateRoomHandler(Context, Mapper);
            var command = new CreateRoomCommand
            {
                Number = "101",
                Type = "double",
                PropertyId = 999
            };

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Contain("999");
            Context.Rooms.Should().BeEmpty();
        }
    }

    public class UpdateRoomStatusHandler_Should : RoomHandlerTestBase
    {
        [Fact]
        public async Task Update_Status_To_Occupied()
        {
            var room = new Room("201", 1, "suite");
            Context.Rooms.Add(room);
            await Context.SaveChangesAsync();

            var handler = new UpdateRoomStatusHandler(Context, Mapper);
            var command = new UpdateRoomStatusCommand { RoomId = room.Id, Status = "occupied" };

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data!.Status.Should().Be("occupied");
        }

        [Fact]
        public async Task Return_Failure_When_Room_Not_Found()
        {
            var handler = new UpdateRoomStatusHandler(Context, Mapper);
            var command = new UpdateRoomStatusCommand { RoomId = 999, Status = "occupied" };

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Contain("999");
        }
    }

    public class UpdateRoomPriceHandler_Should : RoomHandlerTestBase
    {
        [Fact]
        public async Task Update_Price()
        {
            var room = new Room("301", 1, "single");
            Context.Rooms.Add(room);
            await Context.SaveChangesAsync();

            var handler = new UpdateRoomPriceHandler(Context, Mapper);
            var command = new UpdateRoomPriceCommand { RoomId = room.Id, Price = 250.00m };

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data!.Price.Should().Be(250.00m);
        }
    }

    public class UpdateRoomMaxOccupancyHandler_Should : RoomHandlerTestBase
    {
        [Fact]
        public async Task Update_Max_Occupancy()
        {
            var room = new Room("401", 1, "double");
            Context.Rooms.Add(room);
            await Context.SaveChangesAsync();

            var handler = new UpdateRoomMaxOccupancyHandler(Context, Mapper);
            var command = new UpdateRoomMaxOccupancyCommand { RoomId = room.Id, MaxOccupancy = 4 };

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data!.MaxOccupancy.Should().Be(4);
        }
    }

    public class UpdateRoomAmenitiesHandler_Should : RoomHandlerTestBase
    {
        [Fact]
        public async Task Add_Amenity()
        {
            var room = new Room("501", 1, "suite");
            Context.Rooms.Add(room);
            await Context.SaveChangesAsync();

            var handler = new UpdateRoomAmenitiesHandler(Context, Mapper);
            var command = new UpdateRoomAmenitiesCommand { RoomId = room.Id, Action = "add", Amenity = "sauna" };

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data!.Amenities.Should().Contain("sauna");
        }

        [Fact]
        public async Task Remove_Amenity()
        {
            var room = new Room("502", 1, "suite");
            room.AddAmenities(new[] { "wifi", "sauna" });
            Context.Rooms.Add(room);
            await Context.SaveChangesAsync();

            var handler = new UpdateRoomAmenitiesHandler(Context, Mapper);
            var command = new UpdateRoomAmenitiesCommand { RoomId = room.Id, Action = "remove", Amenity = "sauna" };

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data!.Amenities.Should().Contain("wifi");
            result.Data.Amenities.Should().NotContain("sauna");
        }

        [Fact]
        public async Task Return_Failure_For_Invalid_Action()
        {
            var room = new Room("503", 1, "suite");
            Context.Rooms.Add(room);
            await Context.SaveChangesAsync();

            var handler = new UpdateRoomAmenitiesHandler(Context, Mapper);
            var command = new UpdateRoomAmenitiesCommand { RoomId = room.Id, Action = "invalid", Amenity = "wifi" };

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Contain("add");
        }

        [Fact]
        public async Task Return_Failure_For_Empty_Amenity()
        {
            // Previously reached Room.AddAmenity's ArgumentException → 500.
            // Must now surface as a validation failure.
            var room = new Room("504", 1, "suite");
            Context.Rooms.Add(room);
            await Context.SaveChangesAsync();

            var handler = new UpdateRoomAmenitiesHandler(Context, Mapper);
            var command = new UpdateRoomAmenitiesCommand { RoomId = room.Id, Action = "add", Amenity = "  " };

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Contain("Amenity");
        }
    }

    public class UpdateRoomViewHandler_Should : RoomHandlerTestBase
    {
        [Fact]
        public async Task Update_View()
        {
            var room = new Room("601", 1, "double");
            Context.Rooms.Add(room);
            await Context.SaveChangesAsync();

            var handler = new UpdateRoomViewHandler(Context, Mapper);
            var command = new UpdateRoomViewCommand { RoomId = room.Id, View = "mountain" };

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data!.View.Should().Be("mountain");
        }
    }

    public class DeleteRoomHandler_Should : RoomHandlerTestBase
    {
        [Fact]
        public async Task Delete_Room()
        {
            var room = new Room("701", 1, "single");
            Context.Rooms.Add(room);
            await Context.SaveChangesAsync();

            var handler = new DeleteRoomHandler(Context);
            var command = new DeleteRoomCommand { RoomId = room.Id };

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data.Should().BeTrue();
            Context.Rooms.Should().BeEmpty();
        }

        [Fact]
        public async Task Return_Failure_When_Room_Not_Found()
        {
            var handler = new DeleteRoomHandler(Context);
            var command = new DeleteRoomCommand { RoomId = 999 };

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Contain("999");
        }
    }

    public class CreatePropertyWithRoomsHandler_Should : RoomHandlerTestBase
    {
        [Fact]
        public async Task Create_Property_With_Initial_Rooms()
        {
            var handler = new CreatePropertyWithRoomsHandler(Context, Mapper, CurrentUser);
            var command = new CreatePropertyWithRoomsCommand
            {
                Name = "Grand Hotel",
                PropertyId = 10,
                Description = "A luxury hotel",
                Address = "1 Ocean Drive",
                Manager = "Alice",
                Rating = 4.5,
                Phone = "+1-555-0100",
                Email = "info@grand.com",
                InitialRooms = new System.Collections.Generic.List<CreateRoomDto>
                {
                    new() { Number = "101", Type = "double", Price = 200, MaxOccupancy = 2, Floor = 1, Amenities = new[] { "wifi" } },
                    new() { Number = "102", Type = "suite", Price = 350, MaxOccupancy = 4, Floor = 1, Amenities = new[] { "wifi", "balcony" } }
                }
            };

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data.Should().NotBeNull();
            result.Data!.Name.Should().Be("Grand Hotel");
            result.Data.PropertyId.Should().Be(10);
            result.Data.Address.Should().Be("1 Ocean Drive");
            result.Data.Manager.Should().Be("Alice");
            result.Data.Rating.Should().Be(4.5);
            result.Data.Phone.Should().Be("+1-555-0100");
            result.Data.Email.Should().Be("info@grand.com");

            Context.Rooms.Should().HaveCount(2);
            Context.Rooms.Any(r => r.Number == "101").Should().BeTrue();
            Context.Rooms.Any(r => r.Number == "102").Should().BeTrue();
        }

        [Fact]
        public async Task Return_Failure_When_Property_Already_Exists()
        {
            Context.Properties.Add(new Property("Existing", 10));
            await Context.SaveChangesAsync();

            var handler = new CreatePropertyWithRoomsHandler(Context, Mapper, CurrentUser);
            var command = new CreatePropertyWithRoomsCommand
            {
                Name = "Duplicate",
                PropertyId = 10
            };

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Contain("already exists");
        }
    }

    public class GetRoomHandler_Should : RoomHandlerTestBase
    {
        [Fact]
        public async Task Return_Room_Dto_When_Found()
        {
            var room = new Room("801", 1, "double");
            Context.Rooms.Add(room);
            await Context.SaveChangesAsync();

            var handler = new GetRoomHandler(Context, Mapper, CurrentUser);
            var query = new GetRoomQuery(room.Id);

            var result = await handler.Handle(query, CancellationToken.None);

            result.Should().NotBeNull();
            result!.Number.Should().Be("801");
            result.Type.Should().Be("double");
        }

        [Fact]
        public async Task Return_Null_When_Not_Found()
        {
            var handler = new GetRoomHandler(Context, Mapper, CurrentUser);
            var query = new GetRoomQuery(999);

            var result = await handler.Handle(query, CancellationToken.None);

            result.Should().BeNull();
        }
    }

    public class GetRoomsByPropertyHandler_Should : RoomHandlerTestBase
    {
        [Fact]
        public async Task Return_Only_Rooms_For_The_Property()
        {
            Context.Rooms.Add(new Room("901", 1, "double"));
            Context.Rooms.Add(new Room("902", 1, "suite"));
            Context.Rooms.Add(new Room("903", 2, "single"));
            await Context.SaveChangesAsync();

            var handler = new GetRoomsByPropertyHandler(Context, Mapper, CurrentUser);
            var query = new GetRoomsByPropertyQuery(1);

            var result = await handler.Handle(query, CancellationToken.None);

            result.Data.Should().HaveCount(2);
            result.Data.Should().OnlyContain(r => r.PropertyId == 1);
        }
    }

    public class GetPropertyHandler_Should : RoomHandlerTestBase
    {
        [Fact]
        public async Task Return_Property_Dto_When_Found()
        {
            Context.Properties.Add(new Property("Seaside Resort", 1));
            await Context.SaveChangesAsync();

            var handler = new GetPropertyHandler(Context, Mapper);
            var query = new GetPropertyQuery(1);

            var result = await handler.Handle(query, CancellationToken.None);

            result.Should().NotBeNull();
            result!.Name.Should().Be("Seaside Resort");
            result.PropertyId.Should().Be(1);
        }
    }

    public class GetAllPropertiesHandler_Should : RoomHandlerTestBase
    {
        [Fact]
        public async Task Return_All_Properties()
        {
            Context.Properties.Add(new Property("Hotel A", 1));
            Context.Properties.Add(new Property("Hotel B", 2));
            Context.Properties.Add(new Property("Hotel C", 3));
            await Context.SaveChangesAsync();

            var handler = new GetAllPropertiesHandler(Context, Mapper);
            var query = new GetAllPropertiesQuery();

            var result = await handler.Handle(query, CancellationToken.None);

            result.Should().HaveCount(3);
        }
    }

    public class DeletePropertyHandler_Should : RoomHandlerTestBase
    {
        [Fact]
        public async Task Delete_Property()
        {
            Context.Properties.Add(new Property("To Delete", 1));
            await Context.SaveChangesAsync();

            var handler = new DeletePropertyHandler(Context, CurrentUser);
            var command = new DeletePropertyCommand(1);

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data.Should().BeTrue();
            result.NotFound.Should().BeFalse();
            Context.Properties.Should().BeEmpty();
        }

        [Fact]
        public async Task Return_NotFound_When_Property_Not_Found()
        {
            var handler = new DeletePropertyHandler(Context, CurrentUser);
            var command = new DeletePropertyCommand(999);

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeFalse();
            result.NotFound.Should().BeTrue();
        }
    }
}
