using Aquri.Application.Common;
using Aquri.Application.DTOs;
using MediatR;

namespace Aquri.Application.Properties.Commands
{
    /// <summary>
    /// Creates a new property. Returns a DTO (not the entity) to keep the
    /// domain model out of the API contract.
    /// </summary>
    public class CreatePropertyCommand : IRequest<Result<PropertyDto>>
    {
        public string Name { get; set; } = string.Empty;
        public int PropertyId { get; set; }
    }
}
