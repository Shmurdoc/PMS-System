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

        public DeleteGuestHandler(IApplicationDbContext context) => _context = context;

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

            _context.Guests.Remove(guest);
            await _context.SaveChangesAsync(cancellationToken);
            return Result.Ok();
        }
    }
}
