using System;
using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using Aquri.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Payroll
{
    /// <summary>
    /// Sets what a staff member is paid. A new package retires the previous one
    /// so a payslip generated last month still points at last month's rate.
    /// </summary>
    public record UpsertCompensationCommand(
        int PropertyId,
        int UserId,
        string PayType,
        decimal BaseAmount,
        decimal OvertimeMultiplier,
        decimal StandardHours,
        decimal Allowances,
        decimal OtherDeductions,
        DateTime EffectiveFrom) : IRequest<Result<CompensationDto>>;

    public class UpsertCompensationHandler : IRequestHandler<UpsertCompensationCommand, Result<CompensationDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public UpsertCompensationHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<Result<CompensationDto>> Handle(UpsertCompensationCommand request, CancellationToken cancellationToken)
        {
            try
            {
                var propertyId = request.PropertyId > 0 ? request.PropertyId : _currentUser.PropertyId ?? 0;
                if (propertyId <= 0)
                    return Result<CompensationDto>.Failure("A property is required.");

                var user = await _context.Users
                    .FirstOrDefaultAsync(u => u.Id == request.UserId, cancellationToken);

                if (user is null)
                    return Result<CompensationDto>.NotFoundResult();
                if (user.PropertyId != propertyId)
                    return Result<CompensationDto>.Failure("That staff member does not belong to this property.");

                var existing = await _context.EmployeeCompensations
                    .Where(c => c.PropertyId == propertyId && c.UserId == request.UserId && c.Active)
                    .ToListAsync(cancellationToken);

                foreach (var old in existing)
                    old.Deactivate();

                var compensation = new EmployeeCompensation(
                    propertyId,
                    user.Id,
                    user.Name,
                    request.PayType,
                    request.BaseAmount,
                    request.OvertimeMultiplier,
                    request.StandardHours,
                    request.EffectiveFrom,
                    request.Allowances,
                    request.OtherDeductions);

                _context.EmployeeCompensations.Add(compensation);
                await _context.SaveChangesAsync(cancellationToken);

                return Result<CompensationDto>.SuccessResult(CompensationDto.FromEntity(compensation));
            }
            catch (DomainException ex)
            {
                return Result<CompensationDto>.ConflictResult(ex.Message);
            }
            catch (ArgumentException ex)
            {
                return Result<CompensationDto>.Failure(ex.Message);
            }
        }
    }

    /// <summary>Active pay packages for a property, plus retired history when asked.</summary>
    public record GetCompensationsQuery(int? PropertyId, bool ActiveOnly = true)
        : IRequest<List<CompensationDto>>;

    public class GetCompensationsHandler : IRequestHandler<GetCompensationsQuery, List<CompensationDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetCompensationsHandler(IApplicationDbContext context) => _context = context;

        public async Task<List<CompensationDto>> Handle(GetCompensationsQuery request, CancellationToken cancellationToken)
        {
            var query = _context.EmployeeCompensations.AsNoTracking().AsQueryable();

            if (request.PropertyId is > 0)
                query = query.Where(c => c.PropertyId == request.PropertyId);
            if (request.ActiveOnly)
                query = query.Where(c => c.Active);

            var rows = await query
                .OrderBy(c => c.UserName)
                .ThenByDescending(c => c.EffectiveFrom)
                .ToListAsync(cancellationToken);

            return rows.Select(CompensationDto.FromEntity).ToList();
        }
    }
}
