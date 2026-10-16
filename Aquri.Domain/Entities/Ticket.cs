using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using Aquri.Domain.Enums;
using Aquri.Domain.Exceptions;

namespace Aquri.Domain.Entities
{
    /// <summary>An operational ticket — a broken AC, a guest complaint, a lost passport. Replaces the older MaintenanceRequest for day-to-day work; that entity stays for backward compatibility until its callers are migrated.</summary>
    public class Ticket
    {
        public static readonly string[] ValidCategories =
            { "front_desk", "housekeeping", "maintenance", "food_beverage", "security", "it", "guest_service", "other" };

        private static readonly IReadOnlyDictionary<TicketStatus, TicketStatus[]> AllowedTransitions =
            new ReadOnlyDictionary<TicketStatus, TicketStatus[]>(new Dictionary<TicketStatus, TicketStatus[]>
            {
                [TicketStatus.Open]        = new[] { TicketStatus.InProgress, TicketStatus.Pending, TicketStatus.Resolved, TicketStatus.Cancelled },
                [TicketStatus.InProgress]  = new[] { TicketStatus.Pending, TicketStatus.Resolved, TicketStatus.Cancelled },
                [TicketStatus.Pending]     = new[] { TicketStatus.InProgress, TicketStatus.Resolved, TicketStatus.Cancelled },
                [TicketStatus.Resolved]    = new[] { TicketStatus.Closed, TicketStatus.InProgress },
                [TicketStatus.Closed]      = Array.Empty<TicketStatus>(),
                [TicketStatus.Cancelled]   = Array.Empty<TicketStatus>(),
            });

        private readonly List<TicketComment> _comments = new();

        public int Id { get; private set; }

        /// <summary>Human-readable number, e.g. TKT-2026-00042.</summary>
        public string TicketNumber { get; private set; } = string.Empty;

        public string Title { get; private set; } = string.Empty;
        public string Description { get; private set; } = string.Empty;

        public TicketType Type { get; private set; } = TicketType.Issue;
        public string Category { get; private set; } = "other";
        public TicketPriority Priority { get; private set; } = TicketPriority.Medium;
        public TicketStatus Status { get; private set; } = TicketStatus.Open;

        public int? AssigneeId { get; private set; }
        public string? AssigneeName { get; private set; }
        public int? ReporterId { get; private set; }
        public string? ReporterName { get; private set; }

        public int PropertyId { get; private set; }
        public int? RoomId { get; private set; }
        public int? GuestId { get; private set; }
        public string? GuestName { get; private set; }
        public DateTime? DueDate { get; private set; }

        public string[] Tags { get; private set; } = Array.Empty<string>();
        public IReadOnlyCollection<TicketComment> Comments => _comments;

        public DateTime Created { get; private set; }
        public DateTime LastModified { get; private set; }
        public DateTime? ResolvedAt { get; private set; }
        public DateTime? ClosedAt { get; private set; }

        public User? Assignee { get; private set; }
        public User? Reporter { get; private set; }
        public Guest? Guest { get; private set; }

        public Ticket() { }

        public Ticket(
            string ticketNumber, string title, string description,
            TicketType type, string category, TicketPriority priority,
            int propertyId, int reporterId, string reporterName)
        {
            if (string.IsNullOrWhiteSpace(ticketNumber))
                throw new ArgumentException("Ticket number cannot be empty.", nameof(ticketNumber));
            if (string.IsNullOrWhiteSpace(title))
                throw new ArgumentException("Title cannot be empty.", nameof(title));
            if (string.IsNullOrWhiteSpace(description))
                throw new ArgumentException("Description cannot be empty.", nameof(description));
            if (!ValidCategories.Contains(category))
                throw new ArgumentException($"Category must be one of: {string.Join(", ", ValidCategories)}.", nameof(category));
            if (propertyId <= 0)
                throw new ArgumentException("PropertyId must be positive.", nameof(propertyId));
            if (reporterId <= 0)
                throw new ArgumentException("ReporterId must be positive.", nameof(reporterId));

            TicketNumber = ticketNumber.Trim();
            Title = title.Trim();
            Description = description.Trim();
            Type = type;
            Category = category;
            Priority = priority;
            PropertyId = propertyId;
            ReporterId = reporterId;
            ReporterName = reporterName?.Trim();
            Status = TicketStatus.Open;
            Created = DateTime.UtcNow;
            LastModified = DateTime.UtcNow;
        }

        public static bool CanTransitionTo(TicketStatus from, TicketStatus to) =>
            AllowedTransitions.TryGetValue(from, out var allowed) && Array.Exists(allowed, s => s == to);

        public void ChangeStatus(TicketStatus newStatus)
        {
            if (!CanTransitionTo(Status, newStatus))
                throw new DomainException($"Cannot move a ticket from '{Status.ToWire()}' to '{newStatus.ToWire()}'.");

            Status = newStatus;
            if (newStatus == TicketStatus.Resolved)
                ResolvedAt = DateTime.UtcNow;
            if (newStatus == TicketStatus.Closed)
                ClosedAt = DateTime.UtcNow;
            LastModified = DateTime.UtcNow;
        }

        public void ChangePriority(TicketPriority newPriority)
        {
            Priority = newPriority;
            LastModified = DateTime.UtcNow;
        }

        public void Assign(int assigneeId, string assigneeName)
        {
            if (assigneeId <= 0)
                throw new ArgumentException("AssigneeId must be positive.", nameof(assigneeId));
            if (string.IsNullOrWhiteSpace(assigneeName))
                throw new ArgumentException("AssigneeName cannot be empty.", nameof(assigneeName));

            AssigneeId = assigneeId;
            AssigneeName = assigneeName.Trim();
            LastModified = DateTime.UtcNow;
        }

        public void Unassign()
        {
            AssigneeId = null;
            AssigneeName = null;
            LastModified = DateTime.UtcNow;
        }

        public void LinkToRoom(int roomId)
        {
            if (roomId <= 0)
                throw new ArgumentException("RoomId must be positive.", nameof(roomId));

            RoomId = roomId;
            LastModified = DateTime.UtcNow;
        }

        public void LinkToGuest(int guestId, string guestName)
        {
            if (guestId <= 0)
                throw new ArgumentException("GuestId must be positive.", nameof(guestId));

            GuestId = guestId;
            GuestName = guestName?.Trim();
            LastModified = DateTime.UtcNow;
        }

        public void SetDueDate(DateTime? dueDate)
        {
            DueDate = dueDate;
            LastModified = DateTime.UtcNow;
        }

        public void AddComment(TicketComment comment)
        {
            if (comment == null)
                throw new ArgumentNullException(nameof(comment));
            if (comment.TicketId != Id && Id != 0)
                throw new DomainException("Comment belongs to a different ticket.");

            _comments.Add(comment);
            LastModified = DateTime.UtcNow;
        }

        public void AddTag(string tag)
        {
            if (string.IsNullOrWhiteSpace(tag))
                throw new ArgumentException("Tag cannot be empty.", nameof(tag));
            if (!Tags.Contains(tag))
                Tags = Tags.Append(tag.Trim()).ToArray();
        }

        public void RemoveTag(string tag)
        {
            Tags = Tags.Where(t => t != tag).ToArray();
        }
    }
}
