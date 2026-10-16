using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using MediatR;

namespace Aquri.Application.RatePlans
{
    public record CreateRatePlanCommand(
        int PropertyId,
        string Name,
        decimal BaseRate,
        string Season,
        int MinStay,
        string[]? RoomTypes,
        string[]? Restrictions) : IRequest<Result<RatePlanDto>>;

    public class CreateRatePlanHandler : IRequestHandler<CreateRatePlanCommand, Result<RatePlanDto>>
    {
        private readonly IApplicationDbContext _context;

        public CreateRatePlanHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<RatePlanDto>> Handle(CreateRatePlanCommand request, CancellationToken cancellationToken)
        {
            try
            {
                var plan = new RatePlan(request.PropertyId, request.Name, request.BaseRate, request.Season, request.MinStay);

                if (request.RoomTypes is not null)
                    plan.SetRoomTypes(request.RoomTypes);
                if (request.Restrictions is not null)
                    plan.SetRestrictions(request.Restrictions);

                _context.RatePlans.Add(plan);
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
