using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Messages
{
    public record GetMessageQuery(int Id) : IRequest<Result<MessageDto>>;

    public class GetMessageHandler : IRequestHandler<GetMessageQuery, Result<MessageDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetMessageHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<MessageDto>> Handle(GetMessageQuery request, CancellationToken cancellationToken)
        {
            var message = await _context.Messages
                .AsNoTracking()
                .FirstOrDefaultAsync(m => m.Id == request.Id, cancellationToken);

            return message is null
                ? Result<MessageDto>.NotFoundResult()
                : Result<MessageDto>.SuccessResult(MessageDto.FromEntity(message));
        }
    }

    /// <summary>Lists messages, optionally filtered by property, recipient, channel, and unread state.</summary>
    public record GetMessagesQuery(int? PropertyId, int? RecipientId, string? ChannelId, bool? UnreadOnly) : IRequest<List<MessageDto>>;

    public class GetMessagesHandler : IRequestHandler<GetMessagesQuery, List<MessageDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetMessagesHandler(IApplicationDbContext context) => _context = context;

        public async Task<List<MessageDto>> Handle(GetMessagesQuery request, CancellationToken cancellationToken)
        {
            var query = _context.Messages.AsNoTracking().AsQueryable();

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
