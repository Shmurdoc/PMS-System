using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.TaxConfigs
{
    /// <summary>Creates a tax or levy rule with a validity window starting now (or the given date).</summary>
    public record CreateTaxConfigCommand(
        int PropertyId,
        string Name,
        decimal Rate,
        string Type,
        DateTime? ValidFrom,
        bool? Included,
        string[]? ApplicableTo) : IRequest<Result<TaxConfigDto>>;

    public class CreateTaxConfigHandler : IRequestHandler<CreateTaxConfigCommand, Result<TaxConfigDto>>
    {
        private readonly IApplicationDbContext _context;

        public CreateTaxConfigHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<TaxConfigDto>> Handle(CreateTaxConfigCommand request, CancellationToken cancellationToken)
        {
            try
            {
                var tax = new TaxConfig(
                    request.PropertyId,
                    request.Name,
                    request.Rate,
                    request.Type,
                    request.ValidFrom ?? DateTime.UtcNow);

                if (request.Included.HasValue)
                    tax.SetIncluded(request.Included.Value);
                if (request.ApplicableTo is not null)
                    tax.SetApplicableTo(request.ApplicableTo);

                _context.TaxConfigs.Add(tax);
                await _context.SaveChangesAsync(cancellationToken);

                return Result<TaxConfigDto>.SuccessResult(TaxConfigDto.FromEntity(tax));
            }
            catch (ArgumentException ex)
            {
                return Result<TaxConfigDto>.Failure(ex.Message);
            }
        }
    }

    /// <summary>Sparse update: rate, included flag, applicable codes, window end, and deactivation. Name, type, and window start are immutable — they identify the rule; end the window and create a successor instead. Reactivation is not supported.</summary>
    public record UpdateTaxConfigCommand(
        int Id,
        string? Name,
        decimal? Rate,
        string? Type,
        bool? Included,
        DateTime? ValidFrom,
        DateTime? ValidTo,
        bool? Active,
        string[]? ApplicableTo) : IRequest<Result<TaxConfigDto>>;

    public class UpdateTaxConfigHandler : IRequestHandler<UpdateTaxConfigCommand, Result<TaxConfigDto>>
    {
        private readonly IApplicationDbContext _context;

        public UpdateTaxConfigHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<TaxConfigDto>> Handle(UpdateTaxConfigCommand request, CancellationToken cancellationToken)
        {
            var tax = await _context.TaxConfigs
                .FirstOrDefaultAsync(t => t.Id == request.Id, cancellationToken);

            if (tax is null)
                return Result<TaxConfigDto>.NotFoundResult();

            try
            {
                if (request.Rate.HasValue)
                    tax.UpdateRate(request.Rate.Value);
                if (request.Included.HasValue)
                    tax.SetIncluded(request.Included.Value);
                if (request.ApplicableTo is not null)
                    tax.SetApplicableTo(request.ApplicableTo);
                if (request.ValidTo.HasValue)
                    tax.End(request.ValidTo.Value);
                if (request.Active == false)
                    tax.Deactivate();
                // Active == true is intentionally ignored — deactivated rules cannot be reactivated.

                await _context.SaveChangesAsync(cancellationToken);
                return Result<TaxConfigDto>.SuccessResult(TaxConfigDto.FromEntity(tax));
            }
            catch (ArgumentException ex)
            {
                return Result<TaxConfigDto>.Failure(ex.Message);
            }
        }
    }

    public record DeleteTaxConfigCommand(int Id) : IRequest<Result>;

    public class DeleteTaxConfigHandler : IRequestHandler<DeleteTaxConfigCommand, Result>
    {
        private readonly IApplicationDbContext _context;

        public DeleteTaxConfigHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result> Handle(DeleteTaxConfigCommand request, CancellationToken cancellationToken)
        {
            var tax = await _context.TaxConfigs
                .FirstOrDefaultAsync(t => t.Id == request.Id, cancellationToken);

            if (tax is null)
                return Result.NotFoundResult();

            _context.TaxConfigs.Remove(tax);
            await _context.SaveChangesAsync(cancellationToken);
            return Result.Ok();
        }
    }
}
