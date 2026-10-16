using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.RfidTags
{
    /// <summary>Revokes a tag by marking it blocked: taps stop resolving immediately, but the record and its history stay for audit.</summary>
    public record RevokeRfidTagCommand(int Id, string? Notes) : IRequest<Result<RfidTagDto>>;

    public class RevokeRfidTagHandler : IRequestHandler<RevokeRfidTagCommand, Result<RfidTagDto>>
    {
        private readonly IApplicationDbContext _context;

        public RevokeRfidTagHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<RfidTagDto>> Handle(RevokeRfidTagCommand request, CancellationToken cancellationToken)
        {
            var tag = await _context.RfidTags
                .FirstOrDefaultAsync(t => t.Id == request.Id, cancellationToken);

            if (tag is null)
                return Result<RfidTagDto>.NotFoundResult();

            if (tag.Status == RfidTagStatus.Blocked)
                return Result<RfidTagDto>.ConflictResult("Tag is already revoked.");

            tag.ChangeStatus(RfidTagStatus.Blocked);
            if (request.Notes is not null)
                tag.SetNotes(request.Notes);

            await _context.SaveChangesAsync(cancellationToken);
            return Result<RfidTagDto>.SuccessResult(RfidTagDto.FromEntity(tag));
        }
    }
}
