using System;
using System.Linq;
using Aquri.Domain.Entities;
using Aquri.Domain.Enums;

namespace Aquri.Application.Tickets
{
    /// <summary>A single comment on a ticket thread.</summary>
    public class TicketCommentDto
    {
        public int Id { get; init; }
        public int TicketId { get; init; }
        public int UserId { get; init; }
        public string UserName { get; init; } = string.Empty;
        public string Content { get; init; } = string.Empty;
        public bool IsInternal { get; init; }
        public DateTime Created { get; init; }

        public static TicketCommentDto FromEntity(TicketComment comment) => new()
        {
            Id = comment.Id,
            TicketId = comment.TicketId,
            UserId = comment.UserId,
            UserName = comment.UserName,
            Content = comment.Content,
            IsInternal = comment.IsInternal,
            Created = comment.Created
        };
    }

    /// <summary>Maintenance/support ticket as returned by the API.</summary>
    public class TicketDto
    {
        public int Id { get; init; }
        public string TicketNumber { get; init; } = string.Empty;
        public string Title { get; init; } = string.Empty;
        public string Description { get; init; } = string.Empty;
        public string Type { get; init; } = string.Empty;
        public string Category { get; init; } = string.Empty;
        public string Priority { get; init; } = string.Empty;
        public string Status { get; init; } = string.Empty;
        public int? AssigneeId { get; init; }
        public string? AssigneeName { get; init; }
        public int? ReporterId { get; init; }
        public string? ReporterName { get; init; }
        public int PropertyId { get; init; }
        public int? RoomId { get; init; }
        public int? GuestId { get; init; }
        public string? GuestName { get; init; }
        public DateTime? DueDate { get; init; }
        public string[] Tags { get; init; } = Array.Empty<string>();
        public TicketCommentDto[] Comments { get; init; } = Array.Empty<TicketCommentDto>();
        public DateTime Created { get; init; }
        public DateTime? LastModified { get; init; }
        public DateTime? ResolvedAt { get; init; }
        public DateTime? ClosedAt { get; init; }

        public static TicketDto FromEntity(Ticket ticket) => new()
        {
            Id = ticket.Id,
            TicketNumber = ticket.TicketNumber,
            Title = ticket.Title,
            Description = ticket.Description,
            Type = ticket.Type.ToWire(),
            Category = ticket.Category,
            Priority = ticket.Priority.ToWire(),
            Status = ticket.Status.ToWire(),
            AssigneeId = ticket.AssigneeId,
            AssigneeName = ticket.Assignee?.Name,
            ReporterId = ticket.ReporterId,
            ReporterName = ticket.Reporter?.Name,
            PropertyId = ticket.PropertyId,
            RoomId = ticket.RoomId,
            GuestId = ticket.GuestId,
            GuestName = ticket.Guest?.Name,
            DueDate = ticket.DueDate,
            Tags = ticket.Tags,
            Comments = ticket.Comments.Select(TicketCommentDto.FromEntity).ToArray(),
            Created = ticket.Created,
            LastModified = ticket.LastModified,
            ResolvedAt = ticket.ResolvedAt,
            ClosedAt = ticket.ClosedAt
        };
    }
}
