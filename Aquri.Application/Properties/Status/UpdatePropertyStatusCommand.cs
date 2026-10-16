using Aquri.Application.Common;
using Aquri.Application.DTOs;
using Aquri.Domain.Enums;
using MediatR;

namespace Aquri.Application.Properties.Status
{
    public class UpdatePropertyStatusCommand : IRequest<Result<PropertyDto>>
    {
        public int Id { get; set; }
        public PropertyStatus Status { get; set; }
    }
}
