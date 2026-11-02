using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using MediatR;

namespace Aquri.Application.Shifts
{
    public record CreateShiftCommand(
        int PropertyId,
        int UserId,
        string UserName,
        DateTime StartTime,
        DateTime EndTime,
        string Role,
        string? Department) : IRequest<Result<ShiftDto>>;

    public class CreateShiftHandler : IRequestHandler<CreateShiftCommand, Result<ShiftDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public CreateShiftHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<Result<ShiftDto>> Handle(CreateShiftCommand request, CancellationToken cancellationToken)
        {
            try
            {
                var shift = new Shift(
                    request.PropertyId,
                    request.UserId,
                    request.UserName,
                    request.StartTime,
                    request.EndTime,
                    request.Role);

                if (request.Department is not null)
                    shift.SetDepartment(request.Department);

                _context.Shifts.Add(shift);
                await _context.SaveChangesAsync(cancellationToken);

                AuditTrail.Write(_context, _currentUser, "create_shift", "shift", shift.Id.ToString(), shift.UserName);
                await _context.SaveChangesAsync(cancellationToken);

                return Result<ShiftDto>.SuccessResult(ShiftDto.FromEntity(shift));
            }
            catch (ArgumentException ex)
            {
                return Result<ShiftDto>.Failure(ex.Message);
            }
        }
    }
}
