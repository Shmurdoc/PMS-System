namespace Aquri.Application.Common
{
    /// <summary>Application-defined claim names carried in issued JWTs.</summary>
    public static class AuthClaims
    {
        /// <summary>Property scope of the account. Absent for unrestricted accounts (demo users, unrestricted admins) — the security default: no claim, no confinement.</summary>
        public const string PropertyId = "property_id";
    }
}
