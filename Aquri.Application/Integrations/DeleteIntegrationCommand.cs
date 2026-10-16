using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Integrations
{
    /// <summary>Removes an integration (admin-only via the controller).</summary>
    public record DeleteIntegrationCommand(int Id) : IRequest<Result<bool>>;

    public class DeleteIntegrationHandler : IRequestHandler<DeleteIntegrationCommand, Result<bool>>
    {
        private readonly IApplicationDbContext _context;

        public DeleteIntegrationHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<bool>> Handle(DeleteIntegrationCommand request, CancellationToken cancellationToken)
        {
            var integration = await _context.Integrations
                .FirstOrDefaultAsync(e => e.Id == request.Id, cancellationToken);

            if (integration is null)
                return Result<bool>.NotFoundResult();

            _context.Integrations.Remove(integration);
            await _context.SaveChangesAsync(cancellationToken);

            return Result<bool>.SuccessResult(true);
        }
    }
}
