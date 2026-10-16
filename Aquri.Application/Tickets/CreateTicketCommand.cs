using System;
using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using Aquri.Domain.Enums;
using Aquri.Domain.Exceptions;
using MediatR;

namespace Aquri.Application.Tickets
{
    public record CreateTicketCommand(
        int PropertyId,
        int ReporterId,
        string Title,
        string Description,
        string Type,
        string Category,
        string Priority,
        int? RoomId,
        int? GuestId,
        DateTime? DueDate,
        string[] Tags) : IRequest<Result<TicketDto>>;

    public class CreateTicketHandler : IRequestHandler<CreateTicketCommand, Result<TicketDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly INumberGenerator _numbers;

        public CreateTicketHandler(IApplicationDbContext context, INumberGenerator numbers)
        {
            _context = context;
            _numbers = numbers;
        }

        public async Task<Result<TicketDto>> Handle(CreateTicketCommand request, CancellationToken cancellationToken)
        {
            var reporter = await _context.Users.FindAsync(request.ReporterId);
            if (reporter is null)
                return Result<TicketDto>.Failure("Reporter not found.");

            if (!TicketTypeExtensions.TryParseWire(request.Type, out var type))
                return Result<TicketDto>.Failure($"Unknown ticket type '{request.Type}'.");
            if (!TicketPriorityExtensions.TryParseWire(request.Priority, out var priority))
                return Result<TicketDto>.Failure($"Unknown ticket priority '{request.Priority}'.");

            var ticketNumber = await _numbers.NextTicketNumberAsync(cancellationToken);

            try
            {
                var ticket = new Ticket(ticketNumber, request.Title, request.Description,
                    type, request.Category, priority,
                    request.PropertyId, request.ReporterId, reporter.Name);

                if (request.RoomId.HasValue)
                    ticket.LinkToRoom(request.RoomId.Value);
                if (request.GuestId.HasValue)
                {
                    var guest = await _context.Guests.FindAsync(request.GuestId.Value);
                    if (guest is not null)
                        ticket.LinkToGuest(request.GuestId.Value, guest.Name);
                }
                ticket.SetDueDate(request.DueDate);

                if (request.Tags is not null)
                    foreach (var tag in request.Tags)
                        if (!string.IsNullOrWhiteSpace(tag))
                            ticket.AddTag(tag);

                _context.Tickets.Add(ticket);
                await _context.SaveChangesAsync(cancellationToken);

                return Result<TicketDto>.SuccessResult(TicketDto.FromEntity(ticket));
            }
            catch (DomainException ex)
            {
                return Result<TicketDto>.Failure(ex.Message);
            }
            catch (ArgumentException ex)
            {
                return Result<TicketDto>.Failure(ex.Message);
            }
        }
    }
}
