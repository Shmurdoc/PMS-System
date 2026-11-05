using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Guests
{
    /// <summary>Deletes a guest. Referential invariants are guarded here rather than left to the database: guests referenced by bookings, invoices, or payments are protected (409 CONFLICT) — mirroring the Restrict FK behaviour PostgreSQL enforces, and verifiable on the InMemory test provider which does not enforce FKs. Tickets referencing the guest are detached by the database (FK SetNull) and need no guard.</summary>
    public record DeleteGuestCommand(int Id) : IRequest<Result>;

    public class DeleteGuestHandler : IRequestHandler<DeleteGuestCommand, Result>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public DeleteGuestHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<Result> Handle(DeleteGuestCommand request, CancellationToken cancellationToken)
        {
            var guest = await _context.Guests
                .FirstOrDefaultAsync(g => g.Id == request.Id, cancellationToken);

            if (guest is null)
                return Result.NotFoundResult();

            var referenced =
                await _context.Bookings.AnyAsync(b => b.GuestId == request.Id, cancellationToken) ||
                await _context.Invoices.AnyAsync(i => i.GuestId == request.Id, cancellationToken) ||
                await _context.Payments.AnyAsync(p => p.GuestId == request.Id, cancellationToken);
            if (referenced)
                return Result.ConflictResult(
                    "Guest has bookings, invoices, or payments and cannot be deleted.");

            var guestName = guest.Name;
            var guestId = guest.Id.ToString();
            guest.SoftDelete();
            AuditTrail.Write(_context, _currentUser, "delete_guest", "guest", guestId, guestName);
            await _context.SaveChangesAsync(cancellationToken);
            return Result.Ok();
        }
    }

    /// <summary>Permanently purges a guest (GDPR right to be forgotten). Irreversible — audit rows are kept but the guest row is removed.</summary>
    public record PurgeGuestCommand(int Id) : IRequest<Result>;

    public class PurgeGuestHandler : IRequestHandler<PurgeGuestCommand, Result>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public PurgeGuestHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<Result> Handle(PurgeGuestCommand request, CancellationToken cancellationToken)
        {
            // IgnoreQueryFilters so we can find already-soft-deleted guests.
            var guest = await _context.Guests
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(g => g.Id == request.Id, cancellationToken);

            if (guest is null)
                return Result.NotFoundResult();

            var referenced =
                await _context.Bookings.AnyAsync(b => b.GuestId == request.Id, cancellationToken) ||
                await _context.Invoices.AnyAsync(i => i.GuestId == request.Id, cancellationToken) ||
                await _context.Payments.AnyAsync(p => p.GuestId == request.Id, cancellationToken);
            if (referenced)
                return Result.ConflictResult(
                    "Guest has bookings, invoices, or payments and cannot be purged.");

            var guestName = guest.Name;
            var guestId = guest.Id.ToString();
            _context.Guests.Remove(guest);
            AuditTrail.Write(_context, _currentUser, "purge_guest", "guest", guestId, guestName);
            await _context.SaveChangesAsync(cancellationToken);
            return Result.Ok();
        }
    }
}
