using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using Aquri.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Infrastructure.Persistence
{
    /// <summary>
    /// EF Core DbContext for the Aquri PMS. Owns all entity mappings and the
    /// change tracking that backs the Unit of Work pattern.
    /// Implements IApplicationDbContext so the Application layer depends only on abstractions.
    /// </summary>
    public class AquriDbContext : DbContext, IApplicationDbContext
    {
        public AquriDbContext(DbContextOptions<AquriDbContext> options)
            : base(options)
        {
        }

        public DbSet<Property> Properties => Set<Property>();

        public DbSet<MaintenanceRequest> MaintenanceRequests => Set<MaintenanceRequest>();

        public DbSet<Room> Rooms => Set<Room>();

        public DbSet<User> Users => Set<User>();

        public DbSet<Guest> Guests => Set<Guest>();

        public DbSet<Booking> Bookings => Set<Booking>();

        public DbSet<Invoice> Invoices => Set<Invoice>();

        public DbSet<InvoiceItem> InvoiceItems => Set<InvoiceItem>();

        public DbSet<Payment> Payments => Set<Payment>();

        public DbSet<Ticket> Tickets => Set<Ticket>();

        public DbSet<TicketComment> TicketComments => Set<TicketComment>();

        public DbSet<RatePlan> RatePlans => Set<RatePlan>();

        public DbSet<Expense> Expenses => Set<Expense>();

        public DbSet<InventoryItem> InventoryItems => Set<InventoryItem>();

        public DbSet<Shift> Shifts => Set<Shift>();

        public DbSet<AttendanceRecord> AttendanceRecords => Set<AttendanceRecord>();

        public DbSet<Message> Messages => Set<Message>();

        public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

        public DbSet<TaxConfig> TaxConfigs => Set<TaxConfig>();

        public DbSet<NumberSequence> NumberSequences => Set<NumberSequence>();

        public DbSet<AiInsight> AiInsights => Set<AiInsight>();

        public DbSet<Workflow> Workflows => Set<Workflow>();

        public DbSet<Agent> Agents => Set<Agent>();

        public DbSet<AgentLog> AgentLogs => Set<AgentLog>();

        public DbSet<RfidTag> RfidTags => Set<RfidTag>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<Property>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.PropertyId).IsRequired();
                entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
                entity.Property(e => e.Description).HasMaxLength(2000);
                entity.Property(e => e.Status).IsRequired().HasMaxLength(50);
                entity.Property(e => e.Address).HasMaxLength(500);
                entity.Property(e => e.Manager).HasMaxLength(200);
                entity.Property(e => e.Rating).HasColumnType("double precision");
                entity.Property(e => e.Phone).HasMaxLength(50);
                entity.Property(e => e.Email).HasMaxLength(200);
                entity.HasIndex(e => e.PropertyId);
            });

            modelBuilder.Entity<MaintenanceRequest>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Description).IsRequired().HasMaxLength(2000);
                entity.Property(e => e.PropertyId).IsRequired();
                entity.Property(e => e.Status).IsRequired().HasMaxLength(50);
                entity.Property(e => e.Priority).IsRequired().HasMaxLength(50);
                entity.HasIndex(e => e.PropertyId);
            });

            modelBuilder.Entity<Room>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Number).IsRequired().HasMaxLength(20);
                entity.Property(e => e.PropertyId).IsRequired();
                entity.Property(e => e.Type).IsRequired().HasMaxLength(100);
                entity.Property(e => e.Status).IsRequired().HasMaxLength(50)
                    .HasConversion(v => v.ToWire(), v => RoomStatusExtensions.FromWire(v));
                entity.Property(e => e.Price).HasColumnType("decimal(18,2)");
                entity.Property(e => e.BedType).HasMaxLength(50);
                entity.Property(e => e.View).HasMaxLength(50);
                entity.Property(e => e.Description).HasMaxLength(2000);
                entity.Property(e => e.Image).HasMaxLength(500);
                entity.HasIndex(e => new { e.PropertyId, e.Number });
            });

            modelBuilder.Entity<User>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Email).IsRequired().HasMaxLength(320);
                entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
                entity.Property(e => e.Role).IsRequired().HasMaxLength(50);
                entity.Property(e => e.PasswordHash).IsRequired().HasMaxLength(500);
                entity.Property(e => e.Department).HasMaxLength(200);
                entity.Property(e => e.Phone).HasMaxLength(50);
                entity.HasIndex(e => e.Email).IsUnique();
            });

            modelBuilder.Entity<Guest>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
                entity.Property(e => e.Email).IsRequired().HasMaxLength(320);
                entity.Property(e => e.Phone).IsRequired().HasMaxLength(50);
                entity.Property(e => e.IdNumber).HasMaxLength(100);
                entity.Property(e => e.Nationality).HasMaxLength(100);
                entity.Property(e => e.Segment).IsRequired().HasMaxLength(50);
                entity.Property(e => e.VipLevel).HasMaxLength(50);
                entity.Property(e => e.Address).HasMaxLength(500);
                entity.Property(e => e.EmergencyContact).HasMaxLength(200);
                entity.Property(e => e.EmergencyPhone).HasMaxLength(50);
                entity.Property(e => e.CompanyName).HasMaxLength(200);
                entity.Property(e => e.Notes).HasMaxLength(2000);
                entity.Property(e => e.Preferences).HasColumnType("text[]");
                entity.Property(e => e.Allergies).HasColumnType("text[]");
                entity.HasIndex(e => e.Email);
            });

            modelBuilder.Entity<Booking>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Status).IsRequired().HasMaxLength(50)
                    .HasConversion(v => v.ToWire(), v => BookingStatusExtensions.FromWire(v));
                entity.Property(e => e.PaymentStatus).IsRequired().HasMaxLength(50)
                    .HasConversion(v => v.ToWire(), v => BookingPaymentStatusExtensions.FromWire(v));
                entity.Property(e => e.Source).IsRequired().HasMaxLength(100);
                entity.Property(e => e.Amount).HasColumnType("decimal(18,2)");
                entity.Property(e => e.RatePerNight).HasColumnType("decimal(18,2)");
                entity.Property(e => e.DepositPaid).HasColumnType("decimal(18,2)");
                entity.Property(e => e.SpecialRequests).HasMaxLength(2000);
                entity.Property(e => e.Notes).HasMaxLength(2000);
                entity.HasIndex(e => e.PropertyId);
                entity.HasIndex(e => e.GuestId);
                entity.HasIndex(e => new { e.RoomId, e.CheckIn, e.CheckOut });
                entity.HasOne<Property>().WithMany().HasForeignKey(e => e.PropertyId).OnDelete(DeleteBehavior.Restrict);
                // Nav lambda required: a nav-less HasOne<T>() plus a CLR navigation
                // property makes EF create a second relationship with an orphaned
                // shadow FK (GuestId1/RoomId1), so Include(Guest/Room) always
                // returned null while the real FK relationship carried no navs.
                entity.HasOne(e => e.Guest).WithMany().HasForeignKey(e => e.GuestId).OnDelete(DeleteBehavior.Restrict);
                entity.HasOne(e => e.Room).WithMany().HasForeignKey(e => e.RoomId).OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<Invoice>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.InvoiceNumber).IsRequired().HasMaxLength(50);
                entity.Property(e => e.Type).IsRequired().HasMaxLength(50)
                    .HasConversion(v => v.ToWire(), v => InvoiceTypeExtensions.FromWire(v));
                entity.Property(e => e.Status).IsRequired().HasMaxLength(50)
                    .HasConversion(v => v.ToWire(), v => InvoiceStatusExtensions.FromWire(v));
                entity.Property(e => e.Currency).IsRequired().HasMaxLength(10);
                entity.Property(e => e.Subtotal).HasColumnType("decimal(18,2)");
                entity.Property(e => e.TaxAmount).HasColumnType("decimal(18,2)");
                entity.Property(e => e.DiscountAmount).HasColumnType("decimal(18,2)");
                entity.Property(e => e.Total).HasColumnType("decimal(18,2)");
                entity.Property(e => e.PaidAmount).HasColumnType("decimal(18,2)");
                entity.Property(e => e.PaymentMethod).HasMaxLength(50);
                entity.Property(e => e.Notes).HasMaxLength(2000);
                entity.Property(e => e.CreatedBy).HasMaxLength(200);
                entity.HasIndex(e => e.InvoiceNumber).IsUnique();
                entity.HasIndex(e => e.GuestId);
                entity.HasIndex(e => e.PropertyId);
                entity.HasIndex(e => e.BookingId);
                entity.HasOne<Booking>().WithMany().HasForeignKey(e => e.BookingId).OnDelete(DeleteBehavior.SetNull);
                entity.HasOne(e => e.Guest).WithMany().HasForeignKey(e => e.GuestId).OnDelete(DeleteBehavior.Restrict);
                entity.HasOne<Property>().WithMany().HasForeignKey(e => e.PropertyId).OnDelete(DeleteBehavior.Restrict);
                entity.HasMany(e => e.Items).WithOne().HasForeignKey("InvoiceId").OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<InvoiceItem>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Description).IsRequired().HasMaxLength(500);
                entity.Property(e => e.UnitPrice).HasColumnType("decimal(18,2)");
                entity.Property(e => e.TaxRate).HasColumnType("decimal(9,6)");
                entity.Property(e => e.Amount).HasColumnType("decimal(18,2)");
                entity.Property(e => e.Category).IsRequired().HasMaxLength(100);
                entity.HasIndex("InvoiceId");
            });

            modelBuilder.Entity<Payment>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.PaymentNumber).IsRequired().HasMaxLength(50);
                entity.Property(e => e.Amount).HasColumnType("decimal(18,2)");
                entity.Property(e => e.Currency).IsRequired().HasMaxLength(10);
                entity.Property(e => e.Method).IsRequired().HasMaxLength(50);
                entity.Property(e => e.Status).IsRequired().HasMaxLength(50)
                    .HasConversion(v => v.ToWire(), v => PaymentStatusExtensions.FromWire(v));
                entity.Property(e => e.Reference).HasMaxLength(200);
                entity.Property(e => e.TransactionId).HasMaxLength(200);
                entity.Property(e => e.ProcessedBy).IsRequired().HasMaxLength(200);
                entity.HasIndex(e => e.PaymentNumber).IsUnique();
                entity.HasIndex(e => e.GuestId);
                entity.HasIndex(e => e.InvoiceId);
                entity.HasIndex(e => e.BookingId);
                entity.HasOne<Invoice>().WithMany().HasForeignKey(e => e.InvoiceId).OnDelete(DeleteBehavior.SetNull);
                entity.HasOne<Booking>().WithMany().HasForeignKey(e => e.BookingId).OnDelete(DeleteBehavior.SetNull);
                entity.HasOne(e => e.Guest).WithMany().HasForeignKey(e => e.GuestId).OnDelete(DeleteBehavior.Restrict);
                entity.HasOne<Property>().WithMany().HasForeignKey(e => e.PropertyId).OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<Ticket>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.TicketNumber).IsRequired().HasMaxLength(50);
                entity.Property(e => e.Title).IsRequired().HasMaxLength(300);
                entity.Property(e => e.Description).IsRequired().HasMaxLength(4000);
                entity.Property(e => e.Type).IsRequired().HasMaxLength(50)
                    .HasConversion(v => v.ToWire(), v => TicketTypeExtensions.FromWire(v));
                entity.Property(e => e.Category).IsRequired().HasMaxLength(100);
                entity.Property(e => e.Priority).IsRequired().HasMaxLength(50)
                    .HasConversion(v => v.ToWire(), v => TicketPriorityExtensions.FromWire(v));
                entity.Property(e => e.Status).IsRequired().HasMaxLength(50)
                    .HasConversion(v => v.ToWire(), v => TicketStatusExtensions.FromWire(v));
                entity.Property(e => e.AssigneeName).HasMaxLength(200);
                entity.Property(e => e.ReporterName).HasMaxLength(200);
                entity.Property(e => e.GuestName).HasMaxLength(200);
                entity.Property(e => e.Tags).HasColumnType("text[]");
                entity.HasIndex(e => e.TicketNumber).IsUnique();
                entity.HasIndex(e => e.PropertyId);
                entity.HasIndex(e => e.Status);
                entity.HasIndex(e => e.Priority);
                entity.HasIndex(e => e.AssigneeId);
                entity.HasOne<Property>().WithMany().HasForeignKey(e => e.PropertyId).OnDelete(DeleteBehavior.Restrict);
                entity.HasOne<Room>().WithMany().HasForeignKey(e => e.RoomId).OnDelete(DeleteBehavior.SetNull);
                entity.HasOne(e => e.Guest).WithMany().HasForeignKey(e => e.GuestId).OnDelete(DeleteBehavior.SetNull);
                entity.HasMany(e => e.Comments).WithOne().HasForeignKey("TicketId").OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<TicketComment>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.UserName).IsRequired().HasMaxLength(200);
                entity.Property(e => e.Content).IsRequired().HasMaxLength(4000);
                entity.HasIndex("TicketId");
            });

            modelBuilder.Entity<RatePlan>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
                entity.Property(e => e.Season).IsRequired().HasMaxLength(50);
                entity.Property(e => e.BaseRate).HasColumnType("decimal(18,2)");
                entity.Property(e => e.RoomTypes).HasColumnType("text[]");
                entity.Property(e => e.Restrictions).HasColumnType("text[]");
                entity.HasIndex(e => e.PropertyId);
                entity.HasOne<Property>().WithMany().HasForeignKey(e => e.PropertyId).OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<Expense>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Category).IsRequired().HasMaxLength(100);
                entity.Property(e => e.Amount).HasColumnType("decimal(18,2)");
                entity.Property(e => e.Description).IsRequired().HasMaxLength(2000);
                entity.Property(e => e.Status).IsRequired().HasMaxLength(50);
                entity.Property(e => e.SubmittedBy).IsRequired().HasMaxLength(200);
                entity.Property(e => e.ReceiptUrl).HasMaxLength(1000);
                entity.Property(e => e.ApprovedBy).HasMaxLength(200);
                entity.Property(e => e.Vendor).HasMaxLength(200);
                entity.Property(e => e.PaymentMethod).HasMaxLength(50);
                entity.Property(e => e.Notes).HasMaxLength(2000);
                entity.HasIndex(e => e.PropertyId);
                entity.HasIndex(e => e.Status);
                entity.HasOne<Property>().WithMany().HasForeignKey(e => e.PropertyId).OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<InventoryItem>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
                entity.Property(e => e.Category).IsRequired().HasMaxLength(100);
                entity.Property(e => e.Unit).IsRequired().HasMaxLength(50);
                entity.Property(e => e.Price).HasColumnType("decimal(18,2)");
                entity.Property(e => e.Supplier).IsRequired().HasMaxLength(200);
                entity.Property(e => e.Sku).HasMaxLength(100);
                entity.Property(e => e.Location).HasMaxLength(200);
                entity.Property(e => e.Notes).HasMaxLength(2000);
                entity.HasIndex(e => e.PropertyId);
                entity.HasIndex(e => new { e.PropertyId, e.Sku }).IsUnique().HasFilter("\"Sku\" IS NOT NULL");
                entity.HasOne<Property>().WithMany().HasForeignKey(e => e.PropertyId).OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<Shift>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.UserName).IsRequired().HasMaxLength(200);
                entity.Property(e => e.Role).IsRequired().HasMaxLength(100);
                entity.Property(e => e.Status).IsRequired().HasMaxLength(50);
                entity.Property(e => e.Overtime).HasColumnType("decimal(9,2)");
                entity.Property(e => e.Notes).HasMaxLength(2000);
                entity.Property(e => e.SwappedWith).HasMaxLength(200);
                entity.Property(e => e.Department).HasMaxLength(100);
                entity.HasIndex(e => e.PropertyId);
                entity.HasIndex(e => new { e.UserId, e.Date });
                entity.HasOne<Property>().WithMany().HasForeignKey(e => e.PropertyId).OnDelete(DeleteBehavior.Restrict);
                entity.HasOne<User>().WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<AttendanceRecord>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.UserName).IsRequired().HasMaxLength(200);
                entity.Property(e => e.Status).IsRequired().HasMaxLength(50);
                entity.Property(e => e.HoursWorked).HasColumnType("decimal(9,2)");
                entity.Property(e => e.Overtime).HasColumnType("decimal(9,2)");
                entity.Property(e => e.Notes).HasMaxLength(2000);
                entity.HasIndex(e => e.PropertyId);
                entity.HasIndex(e => new { e.UserId, e.Date });
                entity.HasOne<Property>().WithMany().HasForeignKey(e => e.PropertyId).OnDelete(DeleteBehavior.Restrict);
                entity.HasOne<User>().WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<Message>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.SenderName).IsRequired().HasMaxLength(200);
                entity.Property(e => e.Content).IsRequired().HasMaxLength(4000);
                entity.Property(e => e.Avatar).HasMaxLength(500);
                entity.Property(e => e.ChannelId).HasMaxLength(100);
                entity.Property(e => e.Type).IsRequired().HasMaxLength(50);
                entity.Property(e => e.Attachments).HasColumnType("text[]");
                entity.HasIndex(e => e.PropertyId);
                entity.HasIndex(e => e.ChannelId);
                entity.HasIndex(e => e.RecipientId);
                entity.HasOne<Property>().WithMany().HasForeignKey(e => e.PropertyId).OnDelete(DeleteBehavior.Restrict);
                entity.HasOne<User>().WithMany().HasForeignKey(e => e.SenderId).OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<AuditLog>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Action).IsRequired().HasMaxLength(100);
                entity.Property(e => e.EntityType).IsRequired().HasMaxLength(50);
                entity.Property(e => e.EntityId).IsRequired().HasMaxLength(100);
                entity.Property(e => e.EntityName).IsRequired().HasMaxLength(300);
                entity.Property(e => e.UserName).IsRequired().HasMaxLength(200);
                entity.Property(e => e.UserRole).IsRequired().HasMaxLength(50);
                entity.Property(e => e.Details).IsRequired().HasMaxLength(4000);
                entity.Property(e => e.OldValue).HasMaxLength(2000);
                entity.Property(e => e.NewValue).HasMaxLength(2000);
                entity.Property(e => e.IpAddress).HasMaxLength(50);
                entity.HasIndex(e => e.PropertyId);
                entity.HasIndex(e => new { e.EntityType, e.EntityId });
                entity.HasIndex(e => e.Timestamp);
                entity.HasOne<Property>().WithMany().HasForeignKey(e => e.PropertyId).OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<TaxConfig>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
                entity.Property(e => e.Rate).HasColumnType("decimal(9,6)");
                entity.Property(e => e.Type).IsRequired().HasMaxLength(50);
                entity.Property(e => e.ApplicableTo).HasColumnType("text[]");
                entity.HasIndex(e => e.PropertyId);
                entity.HasIndex(e => new { e.PropertyId, e.Type, e.ValidFrom });
                entity.HasOne<Property>().WithMany().HasForeignKey(e => e.PropertyId).OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<NumberSequence>(entity =>
            {
                entity.HasKey(e => e.Key);
                entity.Property(e => e.Key).IsRequired().HasMaxLength(20);
            });

            modelBuilder.Entity<AiInsight>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Type).IsRequired().HasMaxLength(50);
                entity.Property(e => e.Title).IsRequired().HasMaxLength(300);
                entity.Property(e => e.Description).IsRequired().HasMaxLength(4000);
                entity.Property(e => e.Recommendation).IsRequired().HasMaxLength(4000);
                entity.Property(e => e.Impact).IsRequired().HasMaxLength(20);
                entity.HasIndex(e => e.PropertyId);
                entity.HasIndex(e => e.Type);
                entity.HasOne<Property>().WithMany().HasForeignKey(e => e.PropertyId).OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<Workflow>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
                entity.Property(e => e.Description).HasMaxLength(2000);
                entity.Property(e => e.Trigger).IsRequired().HasMaxLength(500);
                entity.Property(e => e.Actions).IsRequired().HasColumnType("text");
                entity.Property(e => e.Status).IsRequired().HasMaxLength(20);
                entity.Property(e => e.CreatedBy).HasMaxLength(200);
                entity.HasIndex(e => e.PropertyId);
                entity.HasIndex(e => e.Status);
                entity.HasOne<Property>().WithMany().HasForeignKey(e => e.PropertyId).OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<Agent>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Key).IsRequired().HasMaxLength(100);
                entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
                entity.Property(e => e.Description).IsRequired().HasMaxLength(2000);
                entity.Property(e => e.Status).IsRequired().HasMaxLength(20);
                entity.HasIndex(e => e.Key).IsUnique();
            });

            modelBuilder.Entity<AgentLog>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Message).IsRequired().HasMaxLength(4000);
                entity.HasIndex(e => e.AgentId);
                entity.HasIndex(e => e.Time);
                // Nav-less lambda: AgentLog has no Agent navigation (an earlier
                // fix stripped orphan navs); a nav-bearing overload no longer compiles.
                entity.HasOne<Agent>().WithMany().HasForeignKey(e => e.AgentId).OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<RfidTag>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.PropertyId).IsRequired();
                entity.Property(e => e.Kind).IsRequired().HasMaxLength(20)
                    .HasConversion(v => v.ToWire(), v => RfidTagKindExtensions.FromWire(v));
                entity.Property(e => e.TagNumber).IsRequired().HasMaxLength(100);
                entity.Property(e => e.Status).IsRequired().HasMaxLength(20)
                    .HasConversion(v => v.ToWire(), v => RfidTagStatusExtensions.FromWire(v));
                entity.Property(e => e.AccessLevel).IsRequired().HasMaxLength(50);
                entity.Property(e => e.Notes).HasMaxLength(2000);
                // One physical card per property — duplicate reads are a programming error.
                entity.HasIndex(e => new { e.PropertyId, e.TagNumber }).IsUnique();
                entity.HasIndex(e => e.PropertyId);
                entity.HasIndex(e => e.UserId);
                entity.HasIndex(e => e.BookingId);
                entity.HasOne<Property>().WithMany().HasForeignKey(e => e.PropertyId).OnDelete(DeleteBehavior.Restrict);
                entity.HasOne<User>().WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Restrict);
                // Booking delete leaves a stub tag rather than blocking the delete;
                // taps already reject tags whose booking is gone.
                entity.HasOne<Booking>().WithMany().HasForeignKey(e => e.BookingId).OnDelete(DeleteBehavior.SetNull);
            });
        }
    }
}
