namespace Aquri.Application.AiChat
{
    /// <summary>A chat answer plus where it came from — deterministic is the default, llm only with a key.</summary>
    public class ChatResponse
    {
        public string Reply { get; init; } = string.Empty;
        public string Source { get; init; } = "deterministic";
        public string? Intent { get; init; }
    }
}
