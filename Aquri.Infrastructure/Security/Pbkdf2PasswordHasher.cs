using System.Security.Cryptography;
using Aquri.Application.Common.Interfaces;

namespace Aquri.Infrastructure.Security
{
    /// <summary>
    /// PBKDF2 password hasher using HMAC-SHA256.
    /// Format: PBKDF2|{iterations}|{saltBase64}|{hashBase64}
    /// 600,000 iterations, 16-byte salt, 32-byte hash — OWASP-recommended range.
    /// </summary>
    public class Pbkdf2PasswordHasher : IPasswordHasher
    {
        private const string Prefix = "PBKDF2";
        private const int Iterations = 600_000;
        private const int SaltSize = 16;
        private const int HashSize = 32;

        public string Hash(string password)
        {
            ArgumentException.ThrowIfNullOrEmpty(password);

            byte[] salt = RandomNumberGenerator.GetBytes(SaltSize);
            byte[] hash = Rfc2898DeriveBytes.Pbkdf2(
                password,
                salt,
                Iterations,
                HashAlgorithmName.SHA256,
                HashSize);

            return string.Join("|", Prefix, Iterations, Convert.ToBase64String(salt), Convert.ToBase64String(hash));
        }

        public bool Verify(string password, string hash)
        {
            if (string.IsNullOrEmpty(password) || string.IsNullOrEmpty(hash))
                return false;

            string[] parts = hash.Split('|');
            if (parts.Length != 4 || parts[0] != Prefix)
                return false;

            if (!int.TryParse(parts[1], out int iterations) || iterations <= 0)
                return false;

            byte[] salt;
            byte[] expectedHash;
            try
            {
                salt = Convert.FromBase64String(parts[2]);
                expectedHash = Convert.FromBase64String(parts[3]);
            }
            catch (FormatException)
            {
                return false;
            }

            byte[] actualHash = Rfc2898DeriveBytes.Pbkdf2(
                password,
                salt,
                iterations,
                HashAlgorithmName.SHA256,
                expectedHash.Length);

            return CryptographicOperations.FixedTimeEquals(actualHash, expectedHash);
        }
    }
}
