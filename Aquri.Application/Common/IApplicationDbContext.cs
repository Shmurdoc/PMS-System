using Aquri.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace Aquri.Application.Common.Interfaces
{
    /// <summary>Single data-access abstraction for the Application layer. Implemented by Infrastructure's AquriDbContext.  This DbContext IS the unit of work: mutate tracked entities, then call SaveChangesAsync once to commit every pending change in a single transaction. Handlers use this directly (CQRS) — there is no separate repository layer.</summary>
    public interface IApplicationDbContext
    {
        DbSet<Property> Properties { get; }
        DbSet<Room> Rooms { get; }
        DbSet<MaintenanceRequest> MaintenanceRequests { get; }
        DbSet<User> Users { get; }
        DbSet<UserPropertyAssignment> UserPropertyAssignments { get; }
        DbSet<Guest> Guests { get; }
        DbSet<Booking> Bookings { get; }
        DbSet<Invoice> Invoices { get; }
        DbSet<InvoiceItem> InvoiceItems { get; }
        DbSet<Payment> Payments { get; }
        DbSet<Ticket> Tickets { get; }
        DbSet<TicketComment> TicketComments { get; }
        DbSet<RatePlan> RatePlans { get; }
        DbSet<Expense> Expenses { get; }
        DbSet<InventoryItem> InventoryItems { get; }
        DbSet<Shift> Shifts { get; }
        DbSet<AttendanceRecord> AttendanceRecords { get; }
        DbSet<Message> Messages { get; }
        DbSet<AuditLog> AuditLogs { get; }
        DbSet<TaxConfig> TaxConfigs { get; }
        DbSet<NumberSequence> NumberSequences { get; }
        DbSet<AiInsight> AiInsights { get; }
        DbSet<Workflow> Workflows { get; }
        DbSet<Agent> Agents { get; }
        DbSet<AgentLog> AgentLogs { get; }
        DbSet<RfidTag> RfidTags { get; }
        DbSet<ElectricityRecord> ElectricityRecords { get; }
        DbSet<Integration> Integrations { get; }
        DbSet<EmployeeCompensation> EmployeeCompensations { get; }
        DbSet<PayrollRun> PayrollRuns { get; }
        DbSet<Payslip> Payslips { get; }

        /// <summary>Change tracker of the underlying DbContext (exposed for retry loops that need to detach stale entities — e.g. NumberGenerator's conflict-reload). Satisfied automatically by EF's DbContext.</summary>
        ChangeTracker ChangeTracker { get; }

        Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
    }
}
