using System.Collections.Generic;
using Aquri.Application.Common;
using Aquri.Application.DTOs;
using MediatR;

namespace Aquri.Application.Properties.Commands
{
    /// <summary>Command to create a property with initial rooms.</summary>
    public class CreatePropertyWithRoomsCommand : IRequest<Result<PropertyDto>>
    {
        /// <summary>Property name.</summary>
        public string Name { get; set; } = string.Empty;

        /// <summary>Property address.</summary>
        public string Address { get; set; } = string.Empty;

        /// <summary>Manager name.</summary>
        public string? Manager { get; set; }

        /// <summary>Property rating (0-5).</summary>
        public double Rating { get; set; }

        /// <summary>Phone number.</summary>
        public string? Phone { get; set; }

        /// <summary>Email address.</summary>
        public string? Email { get; set; }

        /// <summary>Initial rooms to create with the property.</summary>
        public List<CreateRoomDto> InitialRooms { get; set; } = new();

        /// <summary>Property description.</summary>
        public string Description { get; set; } = string.Empty;

        /// <summary>Tenant identifier - links to the Property responsible for this creation. Required - every property must have a PropertyId.</summary>
        public int PropertyId { get; set; }
    }
}
