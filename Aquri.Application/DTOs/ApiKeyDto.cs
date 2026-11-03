using System;

namespace Aquri.Application.DTOs
{
    /// <summary>API key response. The RawKey is only populated on creation — afterwards only the prefix is returned.</summary>
    public class ApiKeyDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Prefix { get; set; } = string.Empty;
        public int? PropertyId { get; set; }
        public DateTime? ExpiresAt { get; set; }
        public bool IsActive { get; set; }
        public DateTime Created { get; set; }
        public DateTime? LastUsedAt { get; set; }

        /// <summary>Raw key value — only present on creation response. Never logged or stored.</summary>
        public string? RawKey { get; set; }
    }
}
