using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Electricity
{
    /// <summary>Removes a meter reading (admin-only via the controller).</summary>
    public record DeleteElectricityRecordCommand(int Id) : IRequest<Result<bool>>;

    public class DeleteElectricityRecordHandler : IRequestHandler<DeleteElectricityRecordCommand, Result<bool>>
    {
        private readonly IApplicationDbContext _context;

        public DeleteElectricityRecordHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<bool>> Handle(DeleteElectricityRecordCommand request, CancellationToken cancellationToken)
        {
            var record = await _context.ElectricityRecords
                .FirstOrDefaultAsync(e => e.Id == request.Id, cancellationToken);

            if (record is null)
                return Result<bool>.NotFoundResult();

            _context.ElectricityRecords.Remove(record);
            await _context.SaveChangesAsync(cancellationToken);

            return Result<bool>.SuccessResult(true);
        }
    }
}
