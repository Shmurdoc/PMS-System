using System.Net.Http.Json;
using Microsoft.Extensions.Options;

namespace Aquri.Application.AiChat
{
    /// <summary>
    /// Minimal chat-completions caller — DeepSeek and Nemotron share the same wire format,
    /// so BaseUrl/Model alone pick the provider. Returns null on any transport or parse failure.
    /// </summary>
    public class OpenAiCompatibleClient
    {
        public const string HttpClientName = "ai";

        private readonly IHttpClientFactory _httpClientFactory;
        private readonly AiChatOptions _options;

        public OpenAiCompatibleClient(IHttpClientFactory httpClientFactory, IOptions<AiChatOptions> options)
        {
            _httpClientFactory = httpClientFactory;
            _options = options.Value;
        }

        public async Task<string?> AskAsync(string systemPrompt, string message, CancellationToken cancellationToken = default)
        {
            var client = _httpClientFactory.CreateClient(HttpClientName);
            var payload = new
            {
                model = _options.Model,
                messages = new object[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = message }
                },
                max_tokens = 500
            };

            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, $"{_options.BaseUrl.TrimEnd('/')}/chat/completions")
                {
                    Content = JsonContent.Create(payload)
                };
                request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _options.ApiKey);

                using var response = await client.SendAsync(request, cancellationToken);
                if (!response.IsSuccessStatusCode)
                    return null;

                var completion = await response.Content.ReadFromJsonAsync<ChatCompletion>(cancellationToken);
                var content = completion?.Choices?.FirstOrDefault()?.Message?.Content;
                return string.IsNullOrWhiteSpace(content) ? null : content;
            }
            catch (Exception ex) when (ex is HttpRequestException or System.Text.Json.JsonException)
            {
                return null;
            }
        }

        private sealed record ChatCompletion(ChatChoice[]? Choices);
        private sealed record ChatChoice(ChatMessage? Message);
        private sealed record ChatMessage(string? Content);
    }
}
