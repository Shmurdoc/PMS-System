using System;
using Aquri.Domain.Entities;

namespace Aquri.Application.Shifts
{
    /// <summary>Scheduled staff shift as returned by the API — shaped for the frontend roster.</summary>
    public class ShiftDto
    {
        public int Id { get; init; }
        public int PropertyId { get; init; }
        public int UserId { get; init; }
        public string UserName { get; init; } = string.Empty;
        public DateTime StartTime { get; init; }
        public DateTime EndTime { get; init; }
        public DateTime Date { get; init; }
        public string Role { get; init; } = string.Empty;
        public string Status { get; init; } = "scheduled";
        public DateTime? BreakStart { get; init; }
        public DateTime? BreakEnd { get; init; }
        public decimal? Overtime { get; init; }
        public string? Notes { get; init; }
        public string? SwappedWith { get; init; }
        public string? Department { get; init; }
        public DateTime Created { get; init; }
        public DateTime LastModified { get; init; }

        public static ShiftDto FromEntity(Shift shift) => new()
        {
            Id = shift.Id,
            PropertyId = shift.PropertyId,
            UserId = shift.UserId,
            UserName = shift.UserName,
            StartTime = shift.StartTime,
            EndTime = shift.EndTime,
            Date = shift.Date,
            Role = shift.Role,
            Status = shift.Status,
            BreakStart = shift.BreakStart,
            BreakEnd = shift.BreakEnd,
            Overtime = shift.Overtime,
            Notes = shift.Notes,
            SwappedWith = shift.SwappedWith,
            Department = shift.Department,
            Created = shift.Created,
            LastModified = shift.LastModified
        };
    }
}
