using System;
using Aquri.Domain.Exceptions;

namespace Aquri.Domain.Entities
{
    /// <summary>
    /// A scheduled work shift for one staff member on one day. Can be swapped
    /// to another person, which keeps who-covered-what on the record.
    /// </summary>
    public class Shift
    {
        public static readonly string[] ValidStatuses = { "scheduled", "completed", "cancelled", "swapped" };

        public int Id { get; private set; }
        public int PropertyId { get; private set; }
        public int UserId { get; private set; }
        public string UserName { get; private set; } = string.Empty;
        public DateTime StartTime { get; private set; }
        public DateTime EndTime { get; private set; }
        public DateTime Date { get; private set; }
        public string Role { get; private set; } = string.Empty;
        public string Status { get; private set; } = "scheduled";
        public DateTime? BreakStart { get; private set; }
        public DateTime? BreakEnd { get; private set; }
        public decimal? Overtime { get; private set; }
        public string? Notes { get; private set; }
        public string? SwappedWith { get; private set; }
        public string? Department { get; private set; }
        public DateTime Created { get; private set; }
        public DateTime LastModified { get; private set; }

        public Shift() { }

        public Shift(int propertyId, int userId, string userName, DateTime startTime, DateTime endTime, string role)
        {
            if (propertyId <= 0)
                throw new ArgumentException("PropertyId must be positive.", nameof(propertyId));
            if (userId <= 0)
                throw new ArgumentException("UserId must be positive.", nameof(userId));
            if (string.IsNullOrWhiteSpace(userName))
                throw new ArgumentException("UserName cannot be empty.", nameof(userName));
            if (endTime <= startTime)
                throw new ArgumentException("End time must be after start time.", nameof(endTime));
            if (string.IsNullOrWhiteSpace(role))
                throw new ArgumentException("Role cannot be empty.", nameof(role));

            PropertyId = propertyId;
            UserId = userId;
            UserName = userName.Trim();
            StartTime = startTime;
            EndTime = endTime;
            Date = startTime.Date;
            Role = role.Trim();
            Status = "scheduled";
            Created = DateTime.UtcNow;
            LastModified = DateTime.UtcNow;
        }

        public void ChangeStatus(string newStatus)
        {
            if (!ValidStatuses.Contains(newStatus))
                throw new ArgumentException($"Status must be one of: {string.Join(", ", ValidStatuses)}.", nameof(newStatus));

            Status = newStatus;
            LastModified = DateTime.UtcNow;
        }

        /// <summary>Moves the shift onto someone else's roster.</summary>
        public void Swap(string newStaffName)
        {
            if (string.IsNullOrWhiteSpace(newStaffName))
                throw new ArgumentException("New staff name cannot be empty.", nameof(newStaffName));
            if (Status == "completed")
                throw new DomainException("Completed shifts cannot be swapped.");

            SwappedWith = UserName;
            UserName = newStaffName.Trim();
            Status = "swapped";
            LastModified = DateTime.UtcNow;
        }

        public void SetBreak(DateTime breakStart, DateTime breakEnd)
        {
            if (breakEnd <= breakStart)
                throw new ArgumentException("Break end must be after break start.", nameof(breakEnd));

            BreakStart = breakStart;
            BreakEnd = breakEnd;
            LastModified = DateTime.UtcNow;
        }

        /// <summary>Records overtime in hours worked beyond the scheduled end.</summary>
        public void RecordOvertime(decimal hours)
        {
            if (hours < 0)
                throw new ArgumentException("Overtime cannot be negative.", nameof(hours));

            Overtime = hours;
            LastModified = DateTime.UtcNow;
        }

        public void SetNotes(string? notes)
        {
            Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
            LastModified = DateTime.UtcNow;
        }

        public void SetDepartment(string? department)
        {
            Department = string.IsNullOrWhiteSpace(department) ? null : department.Trim();
            LastModified = DateTime.UtcNow;
        }
    }
}
