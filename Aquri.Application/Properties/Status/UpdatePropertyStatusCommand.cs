using Aquri.Application.Common;
using Aquri.Application.DTOs;
using Aquri.Domain.Enums;
using MediatR;

namespace Aquri.Application.Properties.Status
{
    /// <summary>
    /// Updates a property's status. Looks up by primary key Id.
    /// </summary>
    public class UpdatePropertyStatusCommand : IRequest<Result<PropertyDto>>
    {
        public int Id { get; set; }
        public PropertyStatus Status { get; set; }
    }
}
