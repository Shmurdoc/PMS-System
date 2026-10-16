using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Integrations
{
    /// <summary>Edits an integration's details. Status changes go through the sync endpoint.</summary>
    public record UpdateIntegrationCommand(
        int Id,
        string? Name,
        string? Category,
        string? Description,
        string? Icon,
        string? ApiKey,
        string? WebhookUrl) : IRequest<Result<IntegrationDto>>;

    public class UpdateIntegrationHandler : IRequestHandler<UpdateIntegrationCommand, Result<IntegrationDto>>
    {
        private readonly IApplicationDbContext _context;

        public UpdateIntegrationHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<IntegrationDto>> Handle(UpdateIntegrationCommand request, CancellationToken cancellationToken)
        {
            var integration = await _context.Integrations
                .FirstOrDefaultAsync(e => e.Id == request.Id, cancellationToken);

            if (integration is null)
                return Result<IntegrationDto>.NotFoundResult();

            try
            {
                integration.Update(request.Name, request.Category, request.Description,
                    request.Icon, request.ApiKey, request.WebhookUrl);

                await _context.SaveChangesAsync(cancellationToken);
                return Result<IntegrationDto>.SuccessResult(IntegrationDto.FromEntity(integration));
            }
            catch (ArgumentException ex)
            {
                return Result<IntegrationDto>.Failure(ex.Message);
            }
            catch (DomainException ex)
            {
                return Result<IntegrationDto>.Failure(ex.Message);
            }
        }
    }
}
