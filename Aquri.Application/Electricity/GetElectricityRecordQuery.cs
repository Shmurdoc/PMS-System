using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Electricity
{
    public record GetElectricityRecordQuery(int Id) : IRequest<Result<ElectricityRecordDto>>;

    public class GetElectricityRecordHandler : IRequestHandler<GetElectricityRecordQuery, Result<ElectricityRecordDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetElectricityRecordHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<ElectricityRecordDto>> Handle(GetElectricityRecordQuery request, CancellationToken cancellationToken)
        {
            var record = await _context.ElectricityRecords
                .AsNoTracking()
                .FirstOrDefaultAsync(e => e.Id == request.Id, cancellationToken);

            return record is null
                ? Result<ElectricityRecordDto>.NotFoundResult()
                : Result<ElectricityRecordDto>.SuccessResult(ElectricityRecordDto.FromEntity(record));
        }
    }

    public record GetElectricityRecordsQuery(int? PropertyId, string? Zone) : IRequest<List<ElectricityRecordDto>>;

    public class GetElectricityRecordsHandler : IRequestHandler<GetElectricityRecordsQuery, List<ElectricityRecordDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetElectricityRecordsHandler(IApplicationDbContext context) => _context = context;

        public async Task<List<ElectricityRecordDto>> Handle(GetElectricityRecordsQuery request, CancellationToken cancellationToken)
        {
            var query = _context.ElectricityRecords.AsNoTracking().AsQueryable();

            if (request.PropertyId.HasValue)
                query = query.Where(e => e.PropertyId == request.PropertyId.Value);
            if (!string.IsNullOrWhiteSpace(request.Zone))
            {
                var zone = request.Zone.Trim();
                query = query.Where(e => e.Zone == zone);
            }

            var records = await query.OrderByDescending(e => e.Date).ToListAsync(cancellationToken);
            return records.Select(ElectricityRecordDto.FromEntity).ToList();
        }
    }
}
