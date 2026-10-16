using System;
using Aquri.Domain.Exceptions;

namespace Aquri.Domain.Entities
{
    /// <summary>One clock-in/clock-out pair for a staff member on a given day. Hours worked are derived when the shift is clocked out.</summary>
    public class AttendanceRecord
    {
        public static readonly string[] ValidStatuses = { "present", "late", "absent", "on_leave" };

        public int Id { get; private set; }
        public int PropertyId { get; private set; }
        public int UserId { get; private set; }
        public string UserName { get; private set; } = string.Empty;
        public DateTime CheckIn { get; private set; }
        public DateTime? CheckOut { get; private set; }
        public DateTime Date { get; private set; }

        /// <summary>present | late | absent | on_leave.</summary>
        public string Status { get; private set; } = "present";
        public decimal? HoursWorked { get; private set; }
        public decimal? Overtime { get; private set; }
        public string? Notes { get; private set; }
        public DateTime Created { get; private set; }
        public DateTime LastModified { get; private set; }

        public AttendanceRecord() { }

        public AttendanceRecord(int propertyId, int userId, string userName, DateTime checkIn)
        {
            if (propertyId <= 0)
                throw new ArgumentException("PropertyId must be positive.", nameof(propertyId));
            if (userId <= 0)
                throw new ArgumentException("UserId must be positive.", nameof(userId));
            if (string.IsNullOrWhiteSpace(userName))
                throw new ArgumentException("UserName cannot be empty.", nameof(userName));

            PropertyId = propertyId;
            UserId = userId;
            UserName = userName.Trim();
            CheckIn = checkIn;
            Date = checkIn.Date;
            Status = "present";
            Created = DateTime.UtcNow;
            LastModified = DateTime.UtcNow;
        }

        public static AttendanceRecord Absent(int propertyId, int userId, string userName, DateTime date)
        {
            var record = new AttendanceRecord(propertyId, userId, userName, date);
            record.Status = "absent";
            return record;
        }

        /// <summary>Clocks the person out and computes hours worked (and overtime past 8h).</summary>
        public void ClockOut(DateTime checkOut)
        {
            if (CheckOut != null)
                throw new DomainException("Already clocked out.");
            if (checkOut <= CheckIn)
                throw new ArgumentException("Check-out must be after check-in.", nameof(checkOut));

            CheckOut = checkOut;
            var hours = (decimal)(checkOut - CheckIn).TotalHours;
            HoursWorked = Math.Round(hours, 2);
            Overtime = hours > 8 ? Math.Round(hours - 8, 2) : 0;
            LastModified = DateTime.UtcNow;
        }

        public void MarkLate()
        {
            if (Status != "present")
                throw new DomainException($"Only present records can be marked late (current: {Status}).");

            Status = "late";
            LastModified = DateTime.UtcNow;
        }

        public void MarkOnLeave(string? notes)
        {
            Status = "on_leave";
            Notes = notes;
            LastModified = DateTime.UtcNow;
        }

        public void SetNotes(string? notes)
        {
            Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
            LastModified = DateTime.UtcNow;
        }
    }
}
