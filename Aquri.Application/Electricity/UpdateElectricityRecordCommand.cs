using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Electricity
{
    public record UpdateElectricityRecordCommand(
        int Id,
        DateTime? Date,
        decimal? Consumption,
        decimal? Cost,
        decimal? PeakDemand,
        string? Zone) : IRequest<Result<ElectricityRecordDto>>;

    public class UpdateElectricityRecordHandler : IRequestHandler<UpdateElectricityRecordCommand, Result<ElectricityRecordDto>>
    {
        private readonly IApplicationDbContext _context;

        public UpdateElectricityRecordHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<ElectricityRecordDto>> Handle(UpdateElectricityRecordCommand request, CancellationToken cancellationToken)
        {
            var record = await _context.ElectricityRecords
                .FirstOrDefaultAsync(e => e.Id == request.Id, cancellationToken);

            if (record is null)
                return Result<ElectricityRecordDto>.NotFoundResult();

            try
            {
                record.Update(request.Date, request.Consumption, request.Cost, request.PeakDemand, request.Zone);
                await _context.SaveChangesAsync(cancellationToken);

                return Result<ElectricityRecordDto>.SuccessResult(ElectricityRecordDto.FromEntity(record));
            }
            catch (ArgumentException ex)
            {
                return Result<ElectricityRecordDto>.Failure(ex.Message);
            }
            catch (DomainException ex)
            {
                return Result<ElectricityRecordDto>.Failure(ex.Message);
            }
        }
    }
}
