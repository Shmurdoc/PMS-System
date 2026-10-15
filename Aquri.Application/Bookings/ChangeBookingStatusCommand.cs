using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Enums;
using Aquri.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Bookings
{
    /// <summary>Transitions a booking to a new status (confirmed, checked-in, checked-out, cancelled).</summary>
    public record ChangeBookingStatusCommand(int Id, string NewStatus) : IRequest<Result<BookingDto>>;

    public class ChangeBookingStatusHandler : IRequestHandler<ChangeBookingStatusCommand, Result<BookingDto>>
    {
        private readonly IApplicationDbContext _context;

        public ChangeBookingStatusHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<BookingDto>> Handle(ChangeBookingStatusCommand request, CancellationToken cancellationToken)
        {
            var booking = await _context.Bookings
                .Include(b => b.Guest)
                .Include(b => b.Room)
                .FirstOrDefaultAsync(b => b.Id == request.Id, cancellationToken);

            if (booking is null)
                return Result<BookingDto>.NotFoundResult();

            if (!BookingStatusExtensions.TryParseWire(request.NewStatus, out var newStatus))
                return Result<BookingDto>.Failure($"Unknown booking status '{request.NewStatus}'.");

            try
            {
                booking.ChangeStatus(newStatus);

                // Update room status based on booking transition
                if (booking.Room is not null)
                {
                    if (newStatus == BookingStatus.CheckedIn)
                        booking.Room.ChangeStatus(RoomStatus.Occupied);
                    else if (newStatus is BookingStatus.CheckedOut or BookingStatus.Cancelled)
                        booking.Room.ChangeStatus(RoomStatus.Available);
                }

                await _context.SaveChangesAsync(cancellationToken);
                return Result<BookingDto>.SuccessResult(BookingDto.FromEntity(booking));
            }
            catch (DomainException ex)
            {
                return Result<BookingDto>.Failure(ex.Message);
            }
            catch (ArgumentException ex)
            {
                return Result<BookingDto>.Failure(ex.Message);
            }
        }
    }

    /// <summary>Records a deposit payment against a booking.</summary>
    public record RecordBookingDepositCommand(int Id, decimal Amount) : IRequest<Result<BookingDto>>;

    public class RecordBookingDepositHandler : IRequestHandler<RecordBookingDepositCommand, Result<BookingDto>>
    {
        private readonly IApplicationDbContext _context;

        public RecordBookingDepositHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<BookingDto>> Handle(RecordBookingDepositCommand request, CancellationToken cancellationToken)
        {
            var booking = await _context.Bookings
                .Include(b => b.Guest)
                .Include(b => b.Room)
                .FirstOrDefaultAsync(b => b.Id == request.Id, cancellationToken);

            if (booking is null)
                return Result<BookingDto>.NotFoundResult();

            try
            {
                booking.RecordDeposit(request.Amount);
                await _context.SaveChangesAsync(cancellationToken);
                return Result<BookingDto>.SuccessResult(BookingDto.FromEntity(booking));
            }
            catch (DomainException ex)
            {
                return Result<BookingDto>.Failure(ex.Message);
            }
            catch (ArgumentException ex)
            {
                return Result<BookingDto>.Failure(ex.Message);
            }
        }
    }
}
