using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.RatePlans
{
    /// <summary>Edits a plan's rate, room types, restrictions, and active flag. Omitted fields keep their current values.</summary>
    public record UpdateRatePlanCommand(
        int Id,
        decimal? BaseRate,
        string[]? RoomTypes,
        string[]? Restrictions,
        bool? Active) : IRequest<Result<RatePlanDto>>;

    public class UpdateRatePlanHandler : IRequestHandler<UpdateRatePlanCommand, Result<RatePlanDto>>
    {
        private readonly IApplicationDbContext _context;

        public UpdateRatePlanHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<RatePlanDto>> Handle(UpdateRatePlanCommand request, CancellationToken cancellationToken)
        {
            var plan = await _context.RatePlans
                .FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);

            if (plan is null)
                return Result<RatePlanDto>.NotFoundResult();

            try
            {
                if (request.BaseRate.HasValue)
                    plan.UpdateBaseRate(request.BaseRate.Value);

                if (request.RoomTypes is not null)
                    plan.SetRoomTypes(request.RoomTypes);
                if (request.Restrictions is not null)
                    plan.SetRestrictions(request.Restrictions);

                if (request.Active == true)
                    plan.Activate();
                else if (request.Active == false)
                    plan.Deactivate();

                await _context.SaveChangesAsync(cancellationToken);
                return Result<RatePlanDto>.SuccessResult(RatePlanDto.FromEntity(plan));
            }
            catch (ArgumentException ex)
            {
                return Result<RatePlanDto>.Failure(ex.Message);
            }
        }
    }
}
