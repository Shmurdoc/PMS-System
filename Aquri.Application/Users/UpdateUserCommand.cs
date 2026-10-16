using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Users
{
    /// <summary>
    /// Updates a staff account (admin only). Sparse semantics: Role, Password,
    /// and the property scope are applied only when supplied (non-null);
    /// Name/Department/Phone are always applied. Email is the login identity and
    /// is immutable — a new address means a new account. An empty Password string
    /// is ignored (never clears a password). ClearProperty unscopes the account
    /// (null wins only when PropertyId is not also supplied). The pipeline
    /// confines scoped admins to accounts within their own property — an
    /// unrestricted account cannot be minted or unscoped by a scoped caller.
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

        public UpdateUserHandler(IApplicationDbContext context, IPasswordHasher passwordHasher)
        {
            _context = context;
            _passwordHasher = passwordHasher;
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

            try
            {
                if (!string.IsNullOrEmpty(request.Password))
                    user.SetPasswordHash(_passwordHasher.Hash(request.Password));
                if (!string.IsNullOrEmpty(request.Role) && user.Role != request.Role)
                    user.ChangeRole(request.Role);

                if (request.ClearProperty)
                    user.AssignProperty(null);
                else if (request.PropertyId.HasValue)
                    user.AssignProperty(request.PropertyId.Value);

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
