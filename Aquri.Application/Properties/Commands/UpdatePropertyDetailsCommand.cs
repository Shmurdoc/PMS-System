using Aquri.Application.Common;
using Aquri.Application.DTOs;
using MediatR;

namespace Aquri.Application.Properties.Commands
{
    /// <summary>Updates the editable descriptive fields of an existing property (name + details). Status is handled separately by <see cref="Status.UpdatePropertyStatusCommand"/>.</summary>
    public class UpdatePropertyDetailsCommand : IRequest<Result<PropertyDto>>
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? Address { get; set; }
        public string? Manager { get; set; }
        public double Rating { get; set; }
        public string? Phone { get; set; }
        public string? Email { get; set; }
    }
}
