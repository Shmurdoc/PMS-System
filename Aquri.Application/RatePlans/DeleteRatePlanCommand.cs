using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.RatePlans
{
    public record DeleteRatePlanCommand(int Id) : IRequest<Result<bool>>;

    public class DeleteRatePlanHandler : IRequestHandler<DeleteRatePlanCommand, Result<bool>>
    {
        private readonly IApplicationDbContext _context;

        public DeleteRatePlanHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<bool>> Handle(DeleteRatePlanCommand request, CancellationToken cancellationToken)
        {
            var plan = await _context.RatePlans
                .FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);

            if (plan is null)
                return Result<bool>.NotFoundResult();

            _context.RatePlans.Remove(plan);
            await _context.SaveChangesAsync(cancellationToken);

            return Result<bool>.SuccessResult(true);
        }
    }
}
