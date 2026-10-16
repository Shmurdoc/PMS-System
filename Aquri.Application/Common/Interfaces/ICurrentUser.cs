namespace Aquri.Application.Common.Interfaces
{
    /// <summary>
    /// The caller's identity as seen by the application layer, taken from the
    /// ambient HTTP principal (nulls outside a request). <see cref="PropertyId"/>
    /// is the account's scope: null means unrestricted — either an anonymous
    /// caller (controllers gate access via [Authorize]) or an account with no
    /// assigned property.
    /// </summary>
    public interface ICurrentUser
    {
        bool IsAuthenticated { get; }

        int? PropertyId { get; }
    }
}
