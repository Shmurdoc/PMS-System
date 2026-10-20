using Aquri.Application.Common;
using Aquri.Application.DTOs;
using MediatR;

namespace Aquri.Application.Rooms.Commands
{
    /// <summary>Command to create a new room.</summary>
    public class CreateRoomCommand : IRequest<Result<RoomDto>>
    {
        /// <summary>Room number (unique within a property).</summary>
        public string Number { get; set; } = string.Empty;

        /// <summary>Room type (single, double, suite, apartment, etc.).</summary>
        public string Type { get; set; } = string.Empty;

        /// <summary>Tenant identifier - links to the Property.</summary>
        public int PropertyId { get; set; }

        /// <summary>Bed type (twin, double, queen, king, sofabed, etc.).</summary>
        public string? BedType { get; set; }

        /// <summary>View type (city, ocean, mountain, garden, None).</summary>
        public string? View { get; set; }

        /// <summary>Initial price.</summary>
        public decimal Price { get; set; }

        /// <summary>Maximum occupancy.</summary>
        public int MaxOccupancy { get; set; }

        /// <summary>Room size in square meters.</summary>
        public int? Size { get; set; }

        /// <summary>Floor number.</summary>
        public int Floor { get; set; }

        /// <summary>Room description.</summary>
        public string? Description { get; set; }

        /// <summary>Initial amenities list.</summary>
        public string[]? Amenities { get; set; }
    }

    /// <summary>Command to delete a room.</summary>
    public class DeleteRoomCommand : IRequest<Result<bool>>
    {
        /// <summary>Room ID.</summary>
        public int RoomId { get; set; }
    }
}
