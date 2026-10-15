using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Tickets
{
    /// <summary>
    /// Deletes a maintenance ticket. Comments cascade with the ticket; room,
    /// guest, and property references are outbound (nothing references a
    /// ticket with Restrict), so no conflict guard is needed.
    /// </summary>
    public record DeleteTicketCommand(int Id) : IRequest<Result>;

    public class DeleteTicketHandler : IRequestHandler<DeleteTicketCommand, Result>
    {
        private readonly IApplicationDbContext _context;

        public DeleteTicketHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result> Handle(DeleteTicketCommand request, CancellationToken cancellationToken)
        {
            var ticket = await _context.Tickets
                .FirstOrDefaultAsync(t => t.Id == request.Id, cancellationToken);

            if (ticket is null)
                return Result.NotFoundResult();

            _context.Tickets.Remove(ticket);
            await _context.SaveChangesAsync(cancellationToken);
            return Result.Ok();
        }
    }
}
