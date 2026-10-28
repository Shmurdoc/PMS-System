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
        bool ClearProperty = false) : IRequest<Result<UserDto>>;

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
            if (request.ClearProperty && request.PropertyId.HasValue)
                return Result<UserDto>.Failure("Supply a PropertyId or ClearProperty, not both.");

            var targetRole = string.IsNullOrEmpty(request.Role) ? user.Role : request.Role;
            var targetProperty = request.ClearProperty
                ? null
                : request.PropertyId ?? user.PropertyId;
            if (targetRole != AppRoles.Admin && targetProperty is null)
                return Result<UserDto>.Failure("PropertyId is required unless the account is an admin.");
            if (request.ClearProperty && targetRole != AppRoles.Admin)
                return Result<UserDto>.Failure("Only an admin account can be removed from a property.");

            // A manager can only manage staff at their own property. An admin is
            // unrestricted and can touch any account on any property.
            var callerRole = _currentUser.UserRole;
            if (callerRole != AppRoles.Admin && user.PropertyId != _currentUser.PropertyId)
                return Result<UserDto>.Failure("You can only manage staff at your own property.");

            try
            {
                if (!string.IsNullOrEmpty(request.Password))
                    user.SetPasswordHash(_passwordHasher.Hash(request.Password));

                // Apply the property before the role change. An unscoped admin
                // becoming a scoped front desk must have a property on the
                // account before ChangeRole will accept the move; changing role
                // first rejects a perfectly valid request.
                if (request.ClearProperty)
                    user.AssignProperty(null);
                else if (request.PropertyId.HasValue)
                    user.AssignProperty(request.PropertyId.Value);

                if (!string.IsNullOrEmpty(request.Role) && user.Role != request.Role)
                    user.ChangeRole(request.Role);

                user.UpdateProfile(request.Name, request.Department, request.Phone);
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
