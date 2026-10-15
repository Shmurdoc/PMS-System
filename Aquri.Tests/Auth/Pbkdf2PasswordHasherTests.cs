using System;
using Aquri.Infrastructure.Security;
using FluentAssertions;
using Xunit;

namespace Aquri.Tests.Auth
{
    /// <summary>
    /// Covers the PBKDF2 password hasher: hash format, verify round-trip,
    /// tamper rejection, and null/empty safety.
    /// </summary>
    public class Pbkdf2PasswordHasherTests
    {
        private readonly Pbkdf2PasswordHasher _hasher = new();

        [Fact]
        public void Hash_Produces_NonEmpty_String_Different_From_Plaintext()
        {
            var hash = _hasher.Hash("admin123");

            hash.Should().NotBeNullOrWhiteSpace();
            hash.Should().NotBe("admin123");
            hash.Should().StartWith("PBKDF2|");
        }

        [Fact]
        public void Hash_Uses_Different_Salts_For_Same_Password()
        {
            var first = _hasher.Hash("admin123");
            var second = _hasher.Hash("admin123");

            first.Should().NotBe(second, "each hash must use a unique random salt");
        }

        [Fact]
        public void Verify_Returns_True_For_Correct_Password()
        {
            var hash = _hasher.Hash("admin123");

            _hasher.Verify("admin123", hash).Should().BeTrue();
        }

        [Fact]
        public void Verify_Returns_False_For_Wrong_Password()
        {
            var hash = _hasher.Hash("admin123");

            _hasher.Verify("wrong-password", hash).Should().BeFalse();
        }

        [Fact]
        public void Verify_Returns_False_For_Tampered_Hash()
        {
            var hash = _hasher.Hash("admin123");
            var tampered = hash.Replace("PBKDF2|", "PBKDF2X|");

            _hasher.Verify("admin123", tampered).Should().BeFalse();
        }

        [Theory]
        [InlineData("")]
        [InlineData(null)]
        public void Hash_Rejects_Null_Or_Empty_Password(string password)
        {
            Action act = () => _hasher.Hash(password);

            act.Should().Throw<ArgumentException>();
        }

        [Theory]
        [InlineData("", "PBKDF2|100000|abc|def")]
        [InlineData("password", "")]
        [InlineData("password", "not-a-valid-format")]
        public void Verify_Returns_False_For_Invalid_Inputs(string password, string hash)
        {
            _hasher.Verify(password, hash).Should().BeFalse();
        }
    }
}
