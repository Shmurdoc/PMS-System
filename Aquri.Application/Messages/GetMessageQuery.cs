using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Messages
{
    /// <summary>Reads one message. Returns 404 for non-participants so ids can't be probed.</summary>
    public record GetMessageQuery(int Id, int ViewerId) : IRequest<Result<MessageDto>>;

    public class GetMessageHandler : IRequestHandler<GetMessageQuery, Result<MessageDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetMessageHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<MessageDto>> Handle(GetMessageQuery request, CancellationToken cancellationToken)
        {
            var viewerKey = request.ViewerId.ToString();
            var message = await _context.Messages
                .AsNoTracking()
                .FirstOrDefaultAsync(m => m.Id == request.Id
                    && (m.SenderId == request.ViewerId
                        || m.RecipientId == request.ViewerId
                        || m.ChannelId == viewerKey), cancellationToken);

            return message is null
                ? Result<MessageDto>.NotFoundResult()
                : Result<MessageDto>.SuccessResult(MessageDto.FromEntity(message));
        }
    }

    /// <summary>
    /// Lists messages, optionally filtered by property, recipient, channel, and unread state.
    /// The reader always sees only what they sent, what was addressed to them by recipient id,
    /// or what was posted to a channel named after their user id (how the UI routes DMs).
    /// </summary>
    public record GetMessagesQuery(int ViewerId, int? PropertyId, int? RecipientId, string? ChannelId, bool? UnreadOnly) : IRequest<List<MessageDto>>;

    public class GetMessagesHandler : IRequestHandler<GetMessagesQuery, List<MessageDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetMessagesHandler(IApplicationDbContext context) => _context = context;

        public async Task<List<MessageDto>> Handle(GetMessagesQuery request, CancellationToken cancellationToken)
        {
            var viewerKey = request.ViewerId.ToString();
            var query = _context.Messages.AsNoTracking().AsQueryable();

            query = query.Where(m =>
                m.SenderId == request.ViewerId
                || m.RecipientId == request.ViewerId
                || m.ChannelId == viewerKey);

            if (request.PropertyId.HasValue)
                query = query.Where(m => m.PropertyId == request.PropertyId.Value);
            if (request.RecipientId.HasValue)
                query = query.Where(m => m.RecipientId == request.RecipientId.Value);
            if (!string.IsNullOrWhiteSpace(request.ChannelId))
                query = query.Where(m => m.ChannelId == request.ChannelId);
            if (request.UnreadOnly == true)
                query = query.Where(m => !m.Read);

            var messages = await query
                .OrderByDescending(m => m.Timestamp)
                .ToListAsync(cancellationToken);

            return messages.Select(MessageDto.FromEntity).ToList();
        }
    }
}
