using Aquri.Application.Common;
using MediatR;

namespace Aquri.Application.AiChat
{
    /// <summary>Answers a chat message through whichever client is configured (deterministic by default).</summary>
    public record SendChatCommand(string Message) : IRequest<Result<ChatResponse>>;

    public class SendChatHandler : IRequestHandler<SendChatCommand, Result<ChatResponse>>
    {
        private readonly IAiChatClient _chat;

        public SendChatHandler(IAiChatClient chat) => _chat = chat;

        public async Task<Result<ChatResponse>> Handle(SendChatCommand request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.Message))
                return Result<ChatResponse>.Failure("Message cannot be empty.");

            var response = await _chat.RespondAsync(request.Message, cancellationToken);
            return Result<ChatResponse>.SuccessResult(response);
        }
    }
}
