using System;
using Aquri.Domain.Entities;

namespace Aquri.Application.Attendance
{
    /// <summary>One clock-in/clock-out pair as returned by the API — shaped for the frontend attendance list.</summary>
    public class AttendanceDto
    {
        public int Id { get; init; }
        public int PropertyId { get; init; }
        public int UserId { get; init; }
        public string UserName { get; init; } = string.Empty;
        public DateTime CheckIn { get; init; }
        public DateTime? CheckOut { get; init; }
        public DateTime Date { get; init; }
        public string Status { get; init; } = "present";
        public decimal? HoursWorked { get; init; }
        public decimal? Overtime { get; init; }
        public string? Notes { get; init; }
        public DateTime Created { get; init; }
        public DateTime LastModified { get; init; }

        public static AttendanceDto FromEntity(AttendanceRecord record) => new()
        {
            Id = record.Id,
            PropertyId = record.PropertyId,
            UserId = record.UserId,
            UserName = record.UserName,
            CheckIn = record.CheckIn,
            CheckOut = record.CheckOut,
            Date = record.Date,
            Status = record.Status,
            HoursWorked = record.HoursWorked,
            Overtime = record.Overtime,
            Notes = record.Notes,
            Created = record.Created,
            LastModified = record.LastModified
        };
    }
}
