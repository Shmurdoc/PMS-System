using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Bookings
{
    /// <summary>Deletes a booking. Nothing references a booking with Restrict — invoices and payments detach (FK SetNull, the payment/money records are preserved) — so no conflict guard is needed. The room status is recomputed so the room does not stay "occupied" after its booking is removed, matching the occupied/available transitions in <see cref="ChangeBookingStatusHandler"/>.</summary>
    public record DeleteBookingCommand(int Id) : IRequest<Result>;

    public class DeleteBookingHandler : IRequestHandler<DeleteBookingCommand, Result>
    {
        private readonly IApplicationDbContext _context;

        public DeleteBookingHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result> Handle(DeleteBookingCommand request, CancellationToken cancellationToken)
        {
            var booking = await _context.Bookings
                .Include(b => b.Room)
                .FirstOrDefaultAsync(b => b.Id == request.Id, cancellationToken);

            if (booking is null)
                return Result.NotFoundResult();

            var roomId = booking.RoomId;

            // Free the room unless another active booking still uses it.
            // Evaluated before Remove: pending deletes are not yet visible to
            // queries, so the booking being deleted would count as its own
            // "other" active booking and keep the room occupied forever.
            var stillOccupied = await _context.Bookings.AnyAsync(
                b => b.RoomId == roomId &&
                     b.Id != booking.Id &&
                     b.Status != BookingStatus.Cancelled &&
                     b.Status != BookingStatus.CheckedOut,
                cancellationToken);

            _context.Bookings.Remove(booking);

            if (booking.Room is not null && !stillOccupied)
                booking.Room.ChangeStatus(RoomStatus.Available);

            await _context.SaveChangesAsync(cancellationToken);
            return Result.Ok();
        }
    }
}
