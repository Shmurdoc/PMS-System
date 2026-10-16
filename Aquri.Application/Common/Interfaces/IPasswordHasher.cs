namespace Aquri.Application.Common.Interfaces
{
    /// <summary>Hashes and verifies passwords. Implementations live in Infrastructure (PBKDF2). The Application layer depends only on this abstraction.</summary>
    public interface IPasswordHasher
    {
        /// <summary>Produces a salted hash of the plaintext password.</summary>
        string Hash(string password);

        /// <summary>Returns true when the plaintext matches the stored hash.</summary>
        bool Verify(string password, string hash);
    }
}
