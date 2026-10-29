using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace Aquri.Infrastructure.Persistence
{
    /// <summary>
    /// EF freezes a collection captured in a global query filter into the
    /// compiled model, so two contexts with different property scopes would
    /// otherwise share the first model that was built. Keying the model cache on
    /// the scope keeps each set of properties on its own model. The number of
    /// distinct scopes is bounded by the ways staff are assigned, not by users.
    /// </summary>
    public sealed class PropertyScopeModelCacheKeyFactory : IModelCacheKeyFactory
    {
        public object Create(DbContext context, bool designTime)
            => (context.GetType(), ScopeKey(context), designTime);

        public object Create(DbContext context)
            => (context.GetType(), ScopeKey(context));

        private static string ScopeKey(DbContext context)
            => context is AquriDbContext aquri ? aquri.ScopeCacheKey : "unknown";
    }
}
