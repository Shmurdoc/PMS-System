namespace Aquri.Application.AiChat
{
    /// <summary>Provider settings for the optional LLM path — defaults stay valid when the AI section is absent.</summary>
    public class AiChatOptions
    {
        public const string SectionName = "AI";

        public string BaseUrl { get; set; } = "https://api.deepseek.com";
        public string Model { get; set; } = "deepseek-flash";
        public string ApiKey { get; set; } = string.Empty;
        public int TimeoutSeconds { get; set; } = 15;
    }
}
