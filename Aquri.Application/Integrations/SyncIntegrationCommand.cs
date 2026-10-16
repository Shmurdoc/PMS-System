using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Integrations
{
    /// <summary>Records a successful sync — stamps the time and flips status to connected.</summary>
    public record SyncIntegrationCommand(int Id) : IRequest<Result<IntegrationDto>>;

    public class SyncIntegrationHandler : IRequestHandler<SyncIntegrationCommand, Result<IntegrationDto>>
    {
        private readonly IApplicationDbContext _context;

        public SyncIntegrationHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<IntegrationDto>> Handle(SyncIntegrationCommand request, CancellationToken cancellationToken)
        {
            var integration = await _context.Integrations
                .FirstOrDefaultAsync(e => e.Id == request.Id, cancellationToken);

            if (integration is null)
                return Result<IntegrationDto>.NotFoundResult();

            integration.MarkSynced();
            await _context.SaveChangesAsync(cancellationToken);

            return Result<IntegrationDto>.SuccessResult(IntegrationDto.FromEntity(integration));
        }
    }
}
