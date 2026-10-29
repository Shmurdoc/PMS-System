using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Users
{
    /// <summary>
    /// Updates a staff account (admin only). Role, password, and property change
    /// only when supplied; name, department, and phone always apply. Email is
    /// the login id and cannot be edited, and an empty password is ignored.
    /// ClearProperty drops the scope, which only works while the account stays
    /// an admin, and passing it together with PropertyId is rejected.
    /// </summary>
    public record UpdateUserCommand(
        int Id,
        string Name,
        string? Department,
        string? Phone,
        string? Role,
        string? Password,
        int? PropertyId = null,
        bool ClearProperty = false,
        IReadOnlyList<int>? PropertyIds = null) : IRequest<Result<UserDto>>;

    public class UpdateUserHandler : IRequestHandler<UpdateUserCommand, Result<UserDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly IPasswordHasher _passwordHasher;
        private readonly ICurrentUser _currentUser;

        public UpdateUserHandler(IApplicationDbContext context, IPasswordHasher passwordHasher, ICurrentUser currentUser)
        {
            _context = context;
            _passwordHasher = passwordHasher;
            _currentUser = currentUser;
        }

        public async Task<Result<UserDto>> Handle(UpdateUserCommand request, CancellationToken cancellationToken)
        {
            var user = await _context.Users
                .Include(u => u.PropertyAssignments)
                .FirstOrDefaultAsync(u => u.Id == request.Id, cancellationToken);

            if (user is null)
                return Result<UserDto>.NotFoundResult();

            // Validate everything up front so the entity is never left half-mutated.
            if (string.IsNullOrWhiteSpace(request.Name))
                return Result<UserDto>.Failure("Name cannot be null or empty.");
            if (!string.IsNullOrEmpty(request.Password) && request.Password.Length < UserRules.MinPasswordLength)
                return Result<UserDto>.Failure($"Password must be at least {UserRules.MinPasswordLength} characters.");
            if (!string.IsNullOrEmpty(request.Role) && !AppRoles.IsValid(request.Role))
                return Result<UserDto>.Failure($"Role must be one of: {string.Join(", ", AppRoles.All)}.");
            if (request.ClearProperty && (request.PropertyId.HasValue || request.PropertyIds is { Count: > 0 }))
                return Result<UserDto>.Failure("Supply property ids or ClearProperty, not both.");

            // Merge the single-property shortcut with the full set.
            var requestedProperties = (request.PropertyIds ?? Array.Empty<int>())
                .Concat(request.PropertyId.HasValue ? new[] { request.PropertyId.Value } : Array.Empty<int>())
                .Distinct()
                .ToList();
            var propertiesSupplied = request.PropertyIds is not null || request.PropertyId.HasValue;

            var targetRole = string.IsNullOrEmpty(request.Role) ? user.Role : request.Role;
            var targetProperties = request.ClearProperty
                ? new List<int>()
                : propertiesSupplied
                    ? requestedProperties
                    : user.PropertyAssignments.Select(a => a.PropertyId).ToList();
            if (targetRole != AppRoles.Admin && targetProperties.Count == 0)
                return Result<UserDto>.Failure("PropertyId is required unless the account is an admin.");
            if (request.ClearProperty && targetRole != AppRoles.Admin)
                return Result<UserDto>.Failure("Only an admin account can be removed from a property.");

            // A manager can only manage staff who work in one of the manager's
            // own properties. An admin is unrestricted.
            var callerRole = _currentUser.UserRole;
            if (callerRole != AppRoles.Admin)
            {
                var worksInCallerScope = user.PropertyAssignments.Any(a => _currentUser.PropertyIds.Contains(a.PropertyId))
                    || (user.PropertyId.HasValue && _currentUser.PropertyIds.Contains(user.PropertyId.Value));
                if (!worksInCallerScope)
                    return Result<UserDto>.Failure("You can only manage staff at your own property.");
            }

            try
            {
                if (!string.IsNullOrEmpty(request.Password))
                    user.SetPasswordHash(_passwordHasher.Hash(request.Password));

                // Apply the properties before the role change. An unscoped admin
                // becoming a scoped front desk must have a property on the
                // account before ChangeRole will accept the move; changing role
                // first rejects a perfectly valid request.
                if (propertiesSupplied || request.ClearProperty)
                    user.ReplacePropertyAssignments(targetProperties);

                if (!string.IsNullOrEmpty(request.Role) && user.Role != request.Role)
                    user.ChangeRole(request.Role);

                user.UpdateProfile(request.Name, request.Department, request.Phone);
                AuditTrail.Write(_context, _currentUser, "update_user", "user", user.Id.ToString(), user.Name);
                await _context.SaveChangesAsync(cancellationToken);

                return Result<UserDto>.SuccessResult(UserDto.FromEntity(user));
            }
            catch (ArgumentException ex)
            {
                return Result<UserDto>.Failure(ex.Message);
            }
        }
    }
}
