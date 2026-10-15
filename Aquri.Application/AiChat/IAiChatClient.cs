namespace Aquri.Application.AiChat
{
    /// <summary>Turns a user message into a reply — deterministic by default, LLM only behind a configured key.</summary>
    public interface IAiChatClient
    {
        Task<ChatResponse> RespondAsync(string message, CancellationToken cancellationToken = default);
    }
}
