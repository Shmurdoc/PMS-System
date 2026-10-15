using System.Runtime.CompilerServices;

namespace Aquri.Tests
{
    /// <summary>
    /// Runs before any test code: appsettings.json no longer ships secrets,
    /// so the suite provides its own config through environment variables.
    /// Set unconditionally so tests behave the same on every machine.
    /// </summary>
    internal static class TestEnvironment
    {
        [ModuleInitializer]
        public static void Initialize()
        {
            Environment.SetEnvironmentVariable(
                "ConnectionStrings__DefaultConnection",
                "Host=localhost;Database=Aquri;Username=aquri_user;Password=test-only-local");
            Environment.SetEnvironmentVariable(
                "Jwt__Key",
                "TestOnlyKeyAtLeast32CharactersLong!!!!");
            Environment.SetEnvironmentVariable("RateLimiting__AuthEnabled", "false");
            Environment.SetEnvironmentVariable("Seed__DemoUsers", "true");
        }
    }
}
