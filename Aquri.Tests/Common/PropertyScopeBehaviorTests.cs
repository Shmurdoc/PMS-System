using System.Threading;
using System.Threading.Tasks;
using Aquri.Application.Common.Behaviors;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Exceptions;
using FluentAssertions;
using MediatR;
using Xunit;

namespace Aquri.Tests.Common
{
    /// <summary>Property-scope pipeline behavior: a user assigned to a property may only send requests targeting that property. Unrestricted users, and requests that carry no property scope at all, pass through untouched.</summary>
    public class PropertyScopeBehaviorTests
    {
        private sealed record ScopedRequest(int PropertyId) : IRequest<string>;

        private sealed record NullableScopedRequest(int? PropertyId) : IRequest<string>;

        private sealed record UnscopedRequest(string Name) : IRequest<string>;

        private sealed class FakeUser : ICurrentUser
        {
            public FakeUser(int? propertyId, bool isAuthenticated = true)
            {
                PropertyId = propertyId;
                IsAuthenticated = isAuthenticated;
            }

            public bool IsAuthenticated { get; }

            public int? PropertyId { get; }

            public int UserId => 0;

            public string UserName => string.Empty;

            public string UserRole => string.Empty;
        }

        private static PropertyScopeBehavior<TRequest, string> BehaviorFor<TRequest>(ICurrentUser user)
            where TRequest : notnull
            => new(user);

        private static Task<string> Pass() => Task.FromResult("passed");

        [Fact]
        public async Task Scoped_User_Sending_Its_Own_Property_Passes_Through()
        {
            var behavior = BehaviorFor<ScopedRequest>(new FakeUser(1));

            var result = await behavior.Handle(new ScopedRequest(1), Pass, CancellationToken.None);

            result.Should().Be("passed");
        }

        [Fact]
        public async Task Scoped_User_Sending_Another_Property_Is_Forbidden()
        {
            var behavior = BehaviorFor<ScopedRequest>(new FakeUser(1));

            var act = () => behavior.Handle(new ScopedRequest(2), Pass, CancellationToken.None);

            await act.Should().ThrowAsync<ForbiddenException>()
                .WithMessage("*property 1*");
        }

        [Fact]
        public async Task Scoped_User_Without_A_Request_Property_Passes()
        {
            var behavior = BehaviorFor<NullableScopedRequest>(new FakeUser(1));

            var result = await behavior.Handle(new NullableScopedRequest(null), Pass, CancellationToken.None);

            result.Should().Be("passed");
        }

        [Fact]
        public async Task Unrestricted_User_Passes_For_Any_Property()
        {
            var behavior = BehaviorFor<ScopedRequest>(new FakeUser(null));

            var result = await behavior.Handle(new ScopedRequest(99), Pass, CancellationToken.None);

            result.Should().Be("passed");
        }

        [Fact]
        public async Task Request_Without_A_Property_Scope_Is_Not_Gated()
        {
            var behavior = BehaviorFor<UnscopedRequest>(new FakeUser(1));

            var result = await behavior.Handle(new UnscopedRequest("anything"), Pass, CancellationToken.None);

            result.Should().Be("passed");
        }

        [Fact]
        public async Task Rejected_Request_Never_Reaches_The_Handler()
        {
            var handlerRan = false;
            var behavior = BehaviorFor<ScopedRequest>(new FakeUser(1));

            var act = () => behavior.Handle(
                new ScopedRequest(2),
                () => { handlerRan = true; return Pass(); },
                CancellationToken.None);

            await act.Should().ThrowAsync<ForbiddenException>();
            handlerRan.Should().BeFalse();
        }
    }
}
