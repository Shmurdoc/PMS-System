using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.MaintenanceRequests
{
    /// <summary>Shared status/priority vocabulary for maintenance requests.</summary>
    public static class MaintenanceRequestVocabulary
    {
        public static readonly string[] ValidStatuses = { "pending", "in_progress", "completed", "scheduled" };
        public static readonly string[] ValidPriorities = { "low", "medium", "high", "urgent" };
    }

    /// <summary>Creates a maintenance request (defaults to pending / medium).</summary>
    public record CreateMaintenanceRequestCommand(
        int PropertyId,
        string Description,
        string? Priority,
        string? Status) : IRequest<Result<MaintenanceRequestDto>>;

    public class CreateMaintenanceRequestHandler : IRequestHandler<CreateMaintenanceRequestCommand, Result<MaintenanceRequestDto>>
    {
        private readonly IApplicationDbContext _context;

        public CreateMaintenanceRequestHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<MaintenanceRequestDto>> Handle(CreateMaintenanceRequestCommand request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.Description))
                return Result<MaintenanceRequestDto>.Failure("Description cannot be empty.");
            if (request.PropertyId <= 0)
                return Result<MaintenanceRequestDto>.Failure("PropertyId must be positive.");

            var priority = string.IsNullOrWhiteSpace(request.Priority) ? "medium" : request.Priority;
            if (!MaintenanceRequestVocabulary.ValidPriorities.Contains(priority))
                return Result<MaintenanceRequestDto>.Failure(
                    $"Priority must be one of: {string.Join(", ", MaintenanceRequestVocabulary.ValidPriorities)}.");

            var status = string.IsNullOrWhiteSpace(request.Status) ? "pending" : request.Status;
            if (!MaintenanceRequestVocabulary.ValidStatuses.Contains(status))
                return Result<MaintenanceRequestDto>.Failure(
                    $"Status must be one of: {string.Join(", ", MaintenanceRequestVocabulary.ValidStatuses)}.");

            var maintenance = new MaintenanceRequest(request.Description.Trim(), request.PropertyId)
            {
                Priority = priority,
                Status = status
            };

            _context.MaintenanceRequests.Add(maintenance);
            await _context.SaveChangesAsync(cancellationToken);

            return Result<MaintenanceRequestDto>.SuccessResult(MaintenanceRequestDto.FromEntity(maintenance));
        }
    }

    /// <summary>Sparse update — description, status, and/or priority.</summary>
    public record UpdateMaintenanceRequestCommand(
        int Id,
        string? Description,
        string? Status,
        string? Priority) : IRequest<Result<MaintenanceRequestDto>>;

    public class UpdateMaintenanceRequestHandler : IRequestHandler<UpdateMaintenanceRequestCommand, Result<MaintenanceRequestDto>>
    {
        private readonly IApplicationDbContext _context;

        public UpdateMaintenanceRequestHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<MaintenanceRequestDto>> Handle(UpdateMaintenanceRequestCommand request, CancellationToken cancellationToken)
        {
            var maintenance = await _context.MaintenanceRequests
                .FirstOrDefaultAsync(m => m.Id == request.Id, cancellationToken);

            if (maintenance is null)
                return Result<MaintenanceRequestDto>.NotFoundResult();

            if (!string.IsNullOrWhiteSpace(request.Description))
                maintenance.Description = request.Description.Trim();

            var newStatus = request.Status ?? maintenance.Status;
            var newPriority = request.Priority ?? maintenance.Priority;

            if (!MaintenanceRequestVocabulary.ValidStatuses.Contains(newStatus))
                return Result<MaintenanceRequestDto>.Failure(
                    $"Status must be one of: {string.Join(", ", MaintenanceRequestVocabulary.ValidStatuses)}.");
            if (!MaintenanceRequestVocabulary.ValidPriorities.Contains(newPriority))
                return Result<MaintenanceRequestDto>.Failure(
                    $"Priority must be one of: {string.Join(", ", MaintenanceRequestVocabulary.ValidPriorities)}.");

            if (newStatus != maintenance.Status || newPriority != maintenance.Priority)
                maintenance.UpdateStatus(newStatus, newPriority);
            else
                maintenance.LastModified = DateTime.UtcNow;

            await _context.SaveChangesAsync(cancellationToken);
            return Result<MaintenanceRequestDto>.SuccessResult(MaintenanceRequestDto.FromEntity(maintenance));
        }
    }

    /// <summary>Deletes a maintenance request.</summary>
    public record DeleteMaintenanceRequestCommand(int Id) : IRequest<Result>;

    public class DeleteMaintenanceRequestHandler : IRequestHandler<DeleteMaintenanceRequestCommand, Result>
    {
        private readonly IApplicationDbContext _context;

        public DeleteMaintenanceRequestHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result> Handle(DeleteMaintenanceRequestCommand request, CancellationToken cancellationToken)
        {
            var maintenance = await _context.MaintenanceRequests
                .FirstOrDefaultAsync(m => m.Id == request.Id, cancellationToken);

            if (maintenance is null)
                return Result.NotFoundResult();

            _context.MaintenanceRequests.Remove(maintenance);
            await _context.SaveChangesAsync(cancellationToken);
            return Result.Ok();
        }
    }
}
