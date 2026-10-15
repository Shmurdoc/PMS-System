using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Aquri.Application.AiChat
{
    /// <summary>
    /// Deterministic first: an empty key answers straight from ChatStats with no network call.
    /// With a key, the LLM gets the same stats as context — any failure quietly drops back to
    /// the deterministic answer so chat never surfaces a transport error.
    /// </summary>
    public class HybridChatClient : IAiChatClient
    {
        private readonly DeterministicChatClient _deterministic;
        private readonly ChatStatsProvider _stats;
        private readonly OpenAiCompatibleClient _llm;
        private readonly AiChatOptions _options;
        private readonly ILogger<HybridChatClient> _logger;

        public HybridChatClient(
            DeterministicChatClient deterministic,
            ChatStatsProvider stats,
            OpenAiCompatibleClient llm,
            IOptions<AiChatOptions> options,
            ILogger<HybridChatClient> logger)
        {
            _deterministic = deterministic;
            _stats = stats;
            _llm = llm;
            _options = options.Value;
            _logger = logger;
        }

        public async Task<ChatResponse> RespondAsync(string message, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(_options.ApiKey))
                return await _deterministic.RespondAsync(message, cancellationToken);

            var chatStats = await _stats.GetAsync(cancellationToken);
            try
            {
                var content = await _llm.AskAsync(BuildSystemPrompt(chatStats), message, cancellationToken);
                if (!string.IsNullOrWhiteSpace(content))
                    return new ChatResponse { Reply = content, Source = "llm" };
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (OperationCanceledException)
            {
                _logger.LogWarning("AI provider timed out after {TimeoutSeconds}s; answering deterministically", _options.TimeoutSeconds);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "AI provider call failed; answering deterministically");
            }

            return await _deterministic.RespondAsync(message, cancellationToken);
        }

        private static string BuildSystemPrompt(ChatStats chatStats) =>
            "You are Aquri's hotel operations assistant. Answer the guest's question in two or three sentences " +
            "using the property statistics below as ground truth — never invent other figures. Output plain text only.\n\n" +
            JsonSerializer.Serialize(chatStats, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
    }
}
