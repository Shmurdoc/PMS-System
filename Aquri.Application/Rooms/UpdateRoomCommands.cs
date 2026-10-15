using Aquri.Application.Common;
using Aquri.Application.DTOs;
using MediatR;

namespace Aquri.Application.Rooms.Commands
{
    /// <summary>
    /// Command to update room status.
    /// </summary>
    public class UpdateRoomStatusCommand : IRequest<Result<RoomDto>>
    {
        /// <summary>
        /// Room ID.
        /// </summary>
        public int RoomId { get; set; }

        /// <summary>
        /// New status (available, occupied, reserved, cleaning, maintenance).
        /// </summary>
        public string Status { get; set; } = string.Empty;
    }

    /// <summary>
    /// Command to update room price.
    /// </summary>
    public class UpdateRoomPriceCommand : IRequest<Result<RoomDto>>
    {
        /// <summary>
        /// Room ID.
        /// </summary>
        public int RoomId { get; set; }

        /// <summary>
        /// New price.
        /// </summary>
        public decimal Price { get; set; }
    }

    /// <summary>
    /// Command to update room max occupancy.
    /// </summary>
    public class UpdateRoomMaxOccupancyCommand : IRequest<Result<RoomDto>>
    {
        /// <summary>
        /// Room ID.
        /// </summary>
        public int RoomId { get; set; }

        /// <summary>
        /// New max occupancy.
        /// </summary>
        public int MaxOccupancy { get; set; }
    }

    /// <summary>
    /// Command to update room amenities.
    /// </summary>
    public class UpdateRoomAmenitiesCommand : IRequest<Result<RoomDto>>
    {
        /// <summary>
        /// Room ID.
        /// </summary>
        public int RoomId { get; set; }

        /// <summary>
        /// Action: "add" or "remove".
        /// </summary>
        public string Action { get; set; } = "add";

        /// <summary>
        /// Amenity name to add or remove.
        /// </summary>
        public string Amenity { get; set; } = string.Empty;
    }

    /// <summary>
    /// Command to update room view.
    /// </summary>
    public class UpdateRoomViewCommand : IRequest<Result<RoomDto>>
    {
        /// <summary>
        /// Room ID.
        /// </summary>
        public int RoomId { get; set; }

        /// <summary>
        /// New view type.
        /// </summary>
        public string View { get; set; } = string.Empty;
    }
}
