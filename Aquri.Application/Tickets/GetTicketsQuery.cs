using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Tickets
{
    /// <summary>Fetches one ticket with its comment thread.</summary>
    public record GetTicketQuery(int Id) : IRequest<Result<TicketDto>>;

    public class GetTicketHandler : IRequestHandler<GetTicketQuery, Result<TicketDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetTicketHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<TicketDto>> Handle(GetTicketQuery request, CancellationToken cancellationToken)
        {
            var ticket = await TicketLoader.Load(_context, request.Id, cancellationToken);
            return ticket is null
                ? Result<TicketDto>.NotFoundResult()
                : Result<TicketDto>.SuccessResult(TicketDto.FromEntity(ticket));
        }
    }

    /// <summary>Lists tickets for a property with optional status/priority filters.</summary>
    public record GetTicketsQuery(int PropertyId, string? Status, string? Priority) : IRequest<List<TicketDto>>;

    public class GetTicketsHandler : IRequestHandler<GetTicketsQuery, List<TicketDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetTicketsHandler(IApplicationDbContext context) => _context = context;

        public async Task<List<TicketDto>> Handle(GetTicketsQuery request, CancellationToken cancellationToken)
        {
            var query = _context.Tickets
                .AsNoTracking()
                .Where(t => t.PropertyId == request.PropertyId);

            if (!string.IsNullOrWhiteSpace(request.Status))
            {
                if (!TicketStatusExtensions.TryParseWire(request.Status, out var statusFilter))
                    return new List<TicketDto>();

                query = query.Where(t => t.Status == statusFilter);
            }
            if (!string.IsNullOrWhiteSpace(request.Priority))
            {
                if (!TicketPriorityExtensions.TryParseWire(request.Priority, out var priorityFilter))
                    return new List<TicketDto>();

                query = query.Where(t => t.Priority == priorityFilter);
            }

            var tickets = await query
                .Include(t => t.Assignee)
                .Include(t => t.Reporter)
                .Include(t => t.Guest)
                .Include(t => t.Comments)
                .OrderByDescending(t => t.Created)
                .ToListAsync(cancellationToken);

            return tickets.Select(TicketDto.FromEntity).ToList();
        }
    }
}
