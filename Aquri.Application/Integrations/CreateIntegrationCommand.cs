using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using MediatR;

namespace Aquri.Application.Integrations
{
    /// <summary>Wires up a new integration. <paramref name="ConfiguredBy"/> is stamped by the controller from the JWT.</summary>
    public record CreateIntegrationCommand(
        int PropertyId,
        string Name,
        string Category,
        string? Description,
        string? Icon,
        string? ApiKey,
        string? WebhookUrl,
        string ConfiguredBy) : IRequest<Result<IntegrationDto>>;

    public class CreateIntegrationHandler : IRequestHandler<CreateIntegrationCommand, Result<IntegrationDto>>
    {
        private readonly IApplicationDbContext _context;

        public CreateIntegrationHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<IntegrationDto>> Handle(CreateIntegrationCommand request, CancellationToken cancellationToken)
        {
            try
            {
                var integration = new Integration(request.PropertyId, request.Name, request.Category,
                    request.Description, request.Icon, request.ApiKey, request.WebhookUrl,
                    request.ConfiguredBy);

                _context.Integrations.Add(integration);
                await _context.SaveChangesAsync(cancellationToken);

                return Result<IntegrationDto>.SuccessResult(IntegrationDto.FromEntity(integration));
            }
            catch (ArgumentException ex)
            {
                return Result<IntegrationDto>.Failure(ex.Message);
            }
        }
    }
}
