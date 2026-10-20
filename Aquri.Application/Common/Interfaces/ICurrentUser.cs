namespace Aquri.Application.Common.Interfaces
{
    /// <summary>The caller's identity as seen by the application layer, taken from the ambient HTTP principal (nulls outside a request). <see cref="PropertyId"/> is the account's scope: null means unrestricted — either an anonymous caller (controllers gate access via [Authorize]) or an account with no assigned property. <see cref="UserId"/>, <see cref="UserName"/> and <see cref="UserRole"/> mirror the JWT claims controllers previously read by hand.</summary>
    public interface ICurrentUser
    {
        bool IsAuthenticated { get; }

        int? PropertyId { get; }

        /// <summary>The signed-in user's id — 0 when unauthenticated or the claim is missing (matches the fallback the controllers used to apply).</summary>
        int UserId { get; }

        /// <summary>The signed-in user's display name — empty when the claim is missing.</summary>
        string UserName { get; }

        /// <summary>The signed-in user's role (admin / manager / …) — empty when the claim is missing.</summary>
        string UserRole { get; }
    }
}
