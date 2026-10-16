using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using MediatR;

namespace Aquri.Application.Electricity
{
    /// <summary>Records a new meter reading for a zone.</summary>
    public record CreateElectricityRecordCommand(
        int PropertyId,
        DateTime Date,
        decimal Consumption,
        decimal Cost,
        decimal PeakDemand,
        string? Zone) : IRequest<Result<ElectricityRecordDto>>;

    public class CreateElectricityRecordHandler : IRequestHandler<CreateElectricityRecordCommand, Result<ElectricityRecordDto>>
    {
        private readonly IApplicationDbContext _context;

        public CreateElectricityRecordHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<ElectricityRecordDto>> Handle(CreateElectricityRecordCommand request, CancellationToken cancellationToken)
        {
            try
            {
                var record = new ElectricityRecord(request.PropertyId, request.Date,
                    request.Consumption, request.Cost, request.PeakDemand, request.Zone);

                _context.ElectricityRecords.Add(record);
                await _context.SaveChangesAsync(cancellationToken);

                return Result<ElectricityRecordDto>.SuccessResult(ElectricityRecordDto.FromEntity(record));
            }
            catch (ArgumentException ex)
            {
                return Result<ElectricityRecordDto>.Failure(ex.Message);
            }
        }
    }
}
