using System.Collections.Generic;
using System.Linq;
using Aquri.Application.Common.Interfaces;

namespace Aquri.Tests.Common
{
    /// <summary>Test double for the signed-in caller. Admin role, property 1
    /// scope, so isolated handler tests behave like an admin working a
    /// property and the audit trail writes succeed.</summary>
    public sealed class FakeCurrentUser : ICurrentUser
    {
        public FakeCurrentUser() { }

        public FakeCurrentUser(params int[] propertyIds) => PropertyIds = propertyIds;

        public bool IsAuthenticated => true;
        public int? PropertyId => PropertyIds.Count > 0 ? PropertyIds.First() : null;
        public IReadOnlyCollection<int> PropertyIds { get; } = new[] { 1 };
        public int UserId => 1;
        public string UserName => "test-user";
        public string UserRole => "admin";
    }
}
