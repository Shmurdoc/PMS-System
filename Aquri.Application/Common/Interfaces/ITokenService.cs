using Aquri.Domain.Entities;

namespace Aquri.Application.Common.Interfaces
{
    /// <summary>Issues signed JWTs for authenticated users. Implementation lives in Infrastructure (System.IdentityModel.Tokens.Jwt).</summary>
    public interface ITokenService
    {
        /// <summary>Creates a signed JWT containing the user's id, email, name, and role claims.</summary>
        string CreateToken(User user);
    }
}
