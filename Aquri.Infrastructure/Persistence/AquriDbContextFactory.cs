using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace Aquri.Infrastructure.Persistence
{
    /// <summary>Design-time factory so `dotnet ef migrations` works without a running host. Resolution order: ConnectionStrings__DefaultConnection env var, then the API project's appsettings files (located by walking up from the compiled assembly, so it works from any working directory), else throw.</summary>
    public class AquriDbContextFactory : IDesignTimeDbContextFactory<AquriDbContext>
    {
        public AquriDbContext CreateDbContext(string[] args)
        {
            var optionsBuilder = new DbContextOptionsBuilder<AquriDbContext>().ReplaceService<Microsoft.EntityFrameworkCore.Infrastructure.IModelCacheKeyFactory, Aquri.Infrastructure.Persistence.PropertyScopeModelCacheKeyFactory>();
            optionsBuilder.UseNpgsql(ResolveConnectionString());

            return new AquriDbContext(optionsBuilder.Options);
        }

        private static string ResolveConnectionString()
        {
            var fromEnv = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
            if (!string.IsNullOrWhiteSpace(fromEnv))
                return fromEnv;

            var config = new ConfigurationBuilder()
                .SetBasePath(FindApiContentRoot())
                .AddJsonFile("appsettings.json", optional: true)
                .AddJsonFile("appsettings.Development.json", optional: true)
                .AddEnvironmentVariables()
                .Build();

            var fromConfig = config.GetConnectionString("DefaultConnection");
            if (!string.IsNullOrWhiteSpace(fromConfig))
                return fromConfig;

            throw new InvalidOperationException(
                "No connection string found. Set ConnectionStrings__DefaultConnection or add one to Aquri.API/appsettings.Development.json before running migrations.");
        }

        private static string FindApiContentRoot()
        {
            var dir = new DirectoryInfo(AppContext.BaseDirectory);
            while (dir is not null)
            {
                if (File.Exists(Path.Combine(dir.FullName, "Aquri.API.csproj")))
                    return dir.FullName;
                dir = dir.Parent!;
            }
            return AppContext.BaseDirectory;
        }
    }
}
