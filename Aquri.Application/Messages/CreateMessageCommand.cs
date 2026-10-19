using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Messages
{
    /// <summary>Sends a staff chat message. SenderId/SenderName are stamped by the controller from the authenticated claims — any body values are ignored.</summary>
    public record CreateMessageCommand(
        int PropertyId,
        int? SenderId,
        string? SenderName,
        string Content,
        string? Type,
        int? RecipientId,
        string? ChannelId,
        string[]? Attachments) : IRequest<Result<MessageDto>>;

    public class CreateMessageHandler : IRequestHandler<CreateMessageCommand, Result<MessageDto>>
    {
        private readonly IApplicationDbContext _context;

        public CreateMessageHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<MessageDto>> Handle(CreateMessageCommand request, CancellationToken cancellationToken)
        {
            if (!request.SenderId.HasValue || string.IsNullOrWhiteSpace(request.SenderName))
                return Result<MessageDto>.Failure("Sender is required.");

            try
            {
                var type = string.IsNullOrWhiteSpace(request.Type) ? "text" : request.Type;
                var message = new Message(
                    request.PropertyId,
                    request.SenderId.Value,
                    request.SenderName,
                    request.Content,
                    type);

                if (request.RecipientId.HasValue)
                    message.SendTo(request.RecipientId.Value);
                if (!string.IsNullOrWhiteSpace(request.ChannelId))
                    message.PostTo(request.ChannelId);
                if (request.Attachments is not null)
                    message.SetAttachments(request.Attachments);

                _context.Messages.Add(message);
                await _context.SaveChangesAsync(cancellationToken);

                return Result<MessageDto>.SuccessResult(MessageDto.FromEntity(message));
            }
            catch (ArgumentException ex)
            {
                return Result<MessageDto>.Failure(ex.Message);
            }
        }
    }

    /// <summary>Marks a message as read — drives the unread badge in the frontend.</summary>
    public record MarkMessageReadCommand(int Id, int CallerUserId) : IRequest<Result<MessageDto>>;

    public class MarkMessageReadHandler : IRequestHandler<MarkMessageReadCommand, Result<MessageDto>>
    {
        private readonly IApplicationDbContext _context;

        public MarkMessageReadHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<MessageDto>> Handle(MarkMessageReadCommand request, CancellationToken cancellationToken)
        {
            var message = await _context.Messages
                .FirstOrDefaultAsync(m => m.Id == request.Id, cancellationToken);

            if (message is null)
                return Result<MessageDto>.NotFoundResult();

            // Only a participant may flip read state — the recipient (by recipient
            // id or by a channel named after their user id, which is how the UI
            // routes DMs) or the sender. Anyone else 404s so ids can't be probed.
            var callerChannel = request.CallerUserId.ToString();
            if (message.SenderId != request.CallerUserId
                && message.RecipientId != request.CallerUserId
                && message.ChannelId != callerChannel)
                return Result<MessageDto>.NotFoundResult();

            message.MarkRead();
            await _context.SaveChangesAsync(cancellationToken);
            return Result<MessageDto>.SuccessResult(MessageDto.FromEntity(message));
        }
    }

    public record DeleteMessageCommand(int Id) : IRequest<Result>;

    public class DeleteMessageHandler : IRequestHandler<DeleteMessageCommand, Result>
    {
        private readonly IApplicationDbContext _context;

        public DeleteMessageHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result> Handle(DeleteMessageCommand request, CancellationToken cancellationToken)
        {
            var message = await _context.Messages
                .FirstOrDefaultAsync(m => m.Id == request.Id, cancellationToken);

            if (message is null)
                return Result.NotFoundResult();

            _context.Messages.Remove(message);
            await _context.SaveChangesAsync(cancellationToken);
            return Result.Ok();
        }
    }
}
