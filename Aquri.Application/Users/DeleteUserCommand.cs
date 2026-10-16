using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Users
{
    /// <summary>Deletes a staff account (admin only). Guards three invariants the database's Restrict FKs would otherwise reject at runtime (or the InMemory test provider would silently allow): 1. You cannot delete the account you are signed in as. 2. The system can never lose its last admin (lockout). 3. Accounts referenced by shifts, attendance records, or sent messages are protected (409 CONFLICT) — those rows keep their audit trail. DeletedByUserId is stamped by the controller from the auth claims.</summary>
    public record DeleteUserCommand(int Id, int? DeletedByUserId) : IRequest<Result>;

    public class DeleteUserHandler : IRequestHandler<DeleteUserCommand, Result>
    {
        private readonly IApplicationDbContext _context;

        public DeleteUserHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result> Handle(DeleteUserCommand request, CancellationToken cancellationToken)
        {
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == request.Id, cancellationToken);

            if (user is null)
                return Result.NotFoundResult();

            if (request.DeletedByUserId.HasValue && request.DeletedByUserId.Value == request.Id)
                return Result.ConflictResult("You cannot delete your own account.");

            if (user.Role == AppRoles.Admin &&
                !await _context.Users.AnyAsync(
                    u => u.Role == AppRoles.Admin && u.Id != request.Id, cancellationToken))
                return Result.ConflictResult("The last admin account cannot be deleted.");

            var hasDependents =
                await _context.Shifts.AnyAsync(s => s.UserId == request.Id, cancellationToken) ||
                await _context.AttendanceRecords.AnyAsync(a => a.UserId == request.Id, cancellationToken) ||
                await _context.Messages.AnyAsync(m => m.SenderId == request.Id, cancellationToken);
            if (hasDependents)
                return Result.ConflictResult(
                    "User has shifts, attendance records, or messages and cannot be deleted.");

            _context.Users.Remove(user);
            await _context.SaveChangesAsync(cancellationToken);
            return Result.Ok();
        }
    }
}
