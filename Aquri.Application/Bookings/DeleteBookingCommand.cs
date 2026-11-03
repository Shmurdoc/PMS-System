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
        private readonly ICurrentUser _currentUser;

        public DeleteBookingHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<Result> Handle(DeleteBookingCommand request, CancellationToken cancellationToken)
        {
            var booking = await _context.Bookings
                .Include(b => b.Room)
                .FirstOrDefaultAsync(b => b.Id == request.Id, cancellationToken);

            if (booking is null)
                return Result.NotFoundResult();

            var roomId = booking.RoomId;

            // Free the room unless another active booking still uses it.
            // Evaluated before SoftDelete: pending deletes are not yet visible to
            // queries, so the booking being deleted would count as its own
            // "other" active booking and keep the room occupied forever.
            var stillOccupied = await _context.Bookings.AnyAsync(
                b => b.RoomId == roomId &&
                     b.Id != booking.Id &&
                     b.Status != BookingStatus.Cancelled &&
                     b.Status != BookingStatus.CheckedOut,
                cancellationToken);

            var bookingId = booking.Id.ToString();
            booking.SoftDelete();
            AuditTrail.Write(_context, _currentUser, "delete_booking", "booking", bookingId, bookingId);

            if (booking.Room is not null && !stillOccupied)
                booking.Room.ChangeStatus(RoomStatus.Available);

            await _context.SaveChangesAsync(cancellationToken);
            return Result.Ok();
        }
    }

    /// <summary>Permanently purges a booking (GDPR right to be forgotten). Irreversible — audit rows are kept but the booking row is removed.</summary>
    public record PurgeBookingCommand(int Id) : IRequest<Result>;

    public class PurgeBookingHandler : IRequestHandler<PurgeBookingCommand, Result>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public PurgeBookingHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<Result> Handle(PurgeBookingCommand request, CancellationToken cancellationToken)
        {
            // IgnoreQueryFilters so we can find already-soft-deleted bookings.
            var booking = await _context.Bookings
                .IgnoreQueryFilters()
                .Include(b => b.Room)
                .FirstOrDefaultAsync(b => b.Id == request.Id, cancellationToken);

            if (booking is null)
                return Result.NotFoundResult();

            var roomId = booking.RoomId;
            var bookingId = booking.Id.ToString();
            _context.Bookings.Remove(booking);
            AuditTrail.Write(_context, _currentUser, "purge_booking", "booking", bookingId, bookingId);

            if (booking.Room is not null)
                booking.Room.ChangeStatus(RoomStatus.Available);

            await _context.SaveChangesAsync(cancellationToken);
            return Result.Ok();
        }
    }
}
