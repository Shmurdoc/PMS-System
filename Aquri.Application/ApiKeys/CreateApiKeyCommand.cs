using System;
using System.Security.Cryptography;
using System.Text;
using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Application.DTOs;
using Aquri.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.ApiKeys
{
    /// <summary>Creates a new API key. The raw key is returned once — callers must store it.</summary>
    public record CreateApiKeyCommand(
        string Name,
        int? PropertyId,
        int? ExpiresInDays) : IRequest<Result<ApiKeyDto>>;

    public class CreateApiKeyHandler : IRequestHandler<CreateApiKeyCommand, Result<ApiKeyDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;
        private readonly IPasswordHasher _passwordHasher;

        public CreateApiKeyHandler(
            IApplicationDbContext context,
            ICurrentUser currentUser,
            IPasswordHasher passwordHasher)
        {
            _context = context;
            _currentUser = currentUser;
            _passwordHasher = passwordHasher;
        }

        public async Task<Result<ApiKeyDto>> Handle(
            CreateApiKeyCommand request,
            CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
                return Result<ApiKeyDto>.Failure("Key name is required.");

            if (request.ExpiresInDays.HasValue && request.ExpiresInDays.Value <= 0)
                return Result<ApiKeyDto>.Failure("Expiry must be a positive number of days.");

            // Validate the caller can access the requested property scope.
            if (request.PropertyId.HasValue &&
                !_currentUser.PropertyIds.Contains(request.PropertyId.Value) &&
                _currentUser.PropertyIds.Count > 0)
                return Result<ApiKeyDto>.Failure("Cannot create a key scoped to a property you do not have access to.");

            // Generate a secure key: aqk_ + 32 url-safe base64 chars.
            var rawKey = GenerateApiKey();
            var keyHash = _passwordHasher.Hash(rawKey);
            var prefix = $"aqk_{rawKey.Substring(0, 8)}";

            var expiresAt = request.ExpiresInDays.HasValue
                ? DateTime.UtcNow.AddDays(request.ExpiresInDays.Value)
                : (DateTime?)null;

            var apiKey = new ApiKey(request.Name, prefix, keyHash, _currentUser.UserId, request.PropertyId, expiresAt);
            _context.ApiKeys.Add(apiKey);
            await _context.SaveChangesAsync(cancellationToken);

            AuditTrail.Write(
                _context, _currentUser, "create_api_key", "api_key", apiKey.Id.ToString(), apiKey.Name);
            await _context.SaveChangesAsync(cancellationToken);

            return Result<ApiKeyDto>.SuccessResult(new ApiKeyDto
            {
                Id = apiKey.Id,
                Name = apiKey.Name,
                Prefix = apiKey.Prefix,
                PropertyId = apiKey.PropertyId,
                ExpiresAt = apiKey.ExpiresAt,
                IsActive = apiKey.IsActive,
                Created = apiKey.Created,
                RawKey = rawKey
            });
        }

        private static string GenerateApiKey()
        {
            var bytes = new byte[24];
            using var rng = RandomNumberGenerator.Create();
            rng.GetBytes(bytes);
            return $"aqk_{Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')}";
        }
    }
}
