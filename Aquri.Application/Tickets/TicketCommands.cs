using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using Aquri.Domain.Enums;
using Aquri.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Tickets
{
    /// <summary>Transitions a ticket through its workflow (open → in-progress → resolved → closed).</summary>
    public record ChangeTicketStatusCommand(int Id, string NewStatus) : IRequest<Result<TicketDto>>;

    public class ChangeTicketStatusHandler : IRequestHandler<ChangeTicketStatusCommand, Result<TicketDto>>
    {
        private readonly IApplicationDbContext _context;

        public ChangeTicketStatusHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<TicketDto>> Handle(ChangeTicketStatusCommand request, CancellationToken cancellationToken)
        {
            var ticket = await TicketLoader.Load(_context, request.Id, cancellationToken);
            if (ticket is null)
                return Result<TicketDto>.NotFoundResult();

            if (!TicketStatusExtensions.TryParseWire(request.NewStatus, out var newStatus))
                return Result<TicketDto>.Failure($"Unknown ticket status '{request.NewStatus}'.");

            try
            {
                ticket.ChangeStatus(newStatus);
                await _context.SaveChangesAsync(cancellationToken);
                return Result<TicketDto>.SuccessResult(TicketDto.FromEntity(ticket));
            }
            catch (DomainException ex)
            {
                return Result<TicketDto>.Failure(ex.Message);
            }
        }
    }

    public record AssignTicketCommand(int Id, int AssigneeId) : IRequest<Result<TicketDto>>;

    public class AssignTicketHandler : IRequestHandler<AssignTicketCommand, Result<TicketDto>>
    {
        private readonly IApplicationDbContext _context;

        public AssignTicketHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<TicketDto>> Handle(AssignTicketCommand request, CancellationToken cancellationToken)
        {
            var ticket = await TicketLoader.Load(_context, request.Id, cancellationToken);
            if (ticket is null)
                return Result<TicketDto>.NotFoundResult();

            var assignee = await _context.Users.FindAsync(request.AssigneeId);
            if (assignee is null)
                return Result<TicketDto>.Failure("Assignee not found.");

            try
            {
                ticket.Assign(request.AssigneeId, assignee.Name);
                await _context.SaveChangesAsync(cancellationToken);
                return Result<TicketDto>.SuccessResult(TicketDto.FromEntity(ticket));
            }
            catch (ArgumentException ex)
            {
                return Result<TicketDto>.Failure(ex.Message);
            }
        }
    }

    public record AddTicketCommentCommand(int Id, int UserId, string Content, bool IsInternal) : IRequest<Result<TicketDto>>;

    public class AddTicketCommentHandler : IRequestHandler<AddTicketCommentCommand, Result<TicketDto>>
    {
        private readonly IApplicationDbContext _context;

        public AddTicketCommentHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<TicketDto>> Handle(AddTicketCommentCommand request, CancellationToken cancellationToken)
        {
            var ticket = await TicketLoader.Load(_context, request.Id, cancellationToken);
            if (ticket is null)
                return Result<TicketDto>.NotFoundResult();

            var user = await _context.Users.FindAsync(request.UserId);
            if (user is null)
                return Result<TicketDto>.Failure("User not found.");

            try
            {
                var comment = new TicketComment(ticket.Id, request.UserId, user.Name, request.Content, request.IsInternal);
                ticket.AddComment(comment);
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

    /// <summary>Loads a ticket with navigation properties shared by ticket handlers.</summary>
    internal static class TicketLoader
    {
        public static Task<Ticket?> Load(IApplicationDbContext context, int id, CancellationToken ct) =>
            context.Tickets
                .Include(t => t.Assignee)
                .Include(t => t.Reporter)
                .Include(t => t.Guest)
                .Include(t => t.Comments)
                .FirstOrDefaultAsync(t => t.Id == id, ct);
    }
}
