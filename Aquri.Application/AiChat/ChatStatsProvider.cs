using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.AiChat
{
    public sealed record RoomTypeCount(string Type, int Count);

    /// <summary>Live property numbers the deterministic chat answers from.</summary>
    public class ChatStats
    {
        public int TotalRooms { get; init; }
        public int OccupiedRooms { get; init; }
        public int AvailableRooms { get; init; }
        public int MaintenanceRooms { get; init; }
        public int CleaningRooms { get; init; }
        public int OccupancyRate { get; init; }
        public IReadOnlyList<RoomTypeCount> RoomTypes { get; init; } = Array.Empty<RoomTypeCount>();

        public int TotalGuests { get; init; }
        public int VipGuests { get; init; }
        public int CorporateGuests { get; init; }

        public int TotalBookings { get; init; }
        public int ActiveBookings { get; init; }
        public int PendingBookings { get; init; }
        public int CancelledBookings { get; init; }
        public int CheckedOutBookings { get; init; }
        public int ConfirmedBookings { get; init; }
        public int CheckedInBookings { get; init; }
        public decimal TotalRevenue { get; init; }
        public decimal AvgRoomRate { get; init; }

        public int TotalInvoices { get; init; }
        public int PendingInvoices { get; init; }
        public int OverdueInvoices { get; init; }
        public int PaidInvoices { get; init; }
        public decimal PaidRevenue { get; init; }
    }

    /// <summary>Aggregates rooms, bookings, guests and invoices into the numbers chat replies quote.</summary>
    public class ChatStatsProvider
    {
        private readonly IApplicationDbContext _context;

        public ChatStatsProvider(IApplicationDbContext context) => _context = context;

        public async Task<ChatStats> GetAsync(CancellationToken cancellationToken = default)
        {
            var rooms = await _context.Rooms.AsNoTracking()
                .OrderBy(r => r.Id).ToListAsync(cancellationToken);
            var bookings = await _context.Bookings.AsNoTracking().ToListAsync(cancellationToken);
            var invoices = await _context.Invoices.AsNoTracking().ToListAsync(cancellationToken);
            var guests = await _context.Guests.AsNoTracking().ToListAsync(cancellationToken);

            var totalRooms = rooms.Count;
            var occupiedRooms = rooms.Count(r => r.Status == RoomStatus.Occupied);
            var occupancyRate = totalRooms > 0
                ? (int)Math.Round(occupiedRooms * 100.0 / totalRooms, MidpointRounding.AwayFromZero)
                : 0;

            var totalNights = bookings.Sum(b => b.Nights);
            var allBookingAmount = bookings.Sum(b => b.Amount);
            var avgRoomRate = totalNights > 0
                ? Math.Round(allBookingAmount / totalNights, 0, MidpointRounding.AwayFromZero)
                : 0m;

            return new ChatStats
            {
                TotalRooms = totalRooms,
                OccupiedRooms = occupiedRooms,
                AvailableRooms = rooms.Count(r => r.Status == RoomStatus.Available),
                MaintenanceRooms = rooms.Count(r => r.Status == RoomStatus.Maintenance),
                CleaningRooms = rooms.Count(r => r.Status == RoomStatus.Cleaning),
                OccupancyRate = occupancyRate,
                RoomTypes = rooms
                    .GroupBy(r => r.Type)
                    .Select(g => new RoomTypeCount(g.Key, g.Count()))
                    .ToList(),

                TotalGuests = guests.Count,
                VipGuests = guests.Count(g => g.Segment == "VIP"),
                CorporateGuests = guests.Count(g => g.Segment == "Corporate"),

                TotalBookings = bookings.Count,
                ActiveBookings = bookings.Count(b => b.Status == BookingStatus.CheckedIn || b.Status == BookingStatus.Confirmed),
                PendingBookings = bookings.Count(b => b.Status == BookingStatus.Pending),
                CancelledBookings = bookings.Count(b => b.Status == BookingStatus.Cancelled),
                CheckedOutBookings = bookings.Count(b => b.Status == BookingStatus.CheckedOut),
                ConfirmedBookings = bookings.Count(b => b.Status == BookingStatus.Confirmed),
                CheckedInBookings = bookings.Count(b => b.Status == BookingStatus.CheckedIn),
                TotalRevenue = bookings.Where(b => b.Status != BookingStatus.Cancelled).Sum(b => b.Amount),
                AvgRoomRate = avgRoomRate,

                TotalInvoices = invoices.Count,
                PendingInvoices = invoices.Count(i => i.Status == InvoiceStatus.Pending),
                OverdueInvoices = invoices.Count(i => i.Status == InvoiceStatus.Overdue),
                PaidInvoices = invoices.Count(i => i.Status == InvoiceStatus.Paid),
                PaidRevenue = invoices.Where(i => i.Status == InvoiceStatus.Paid).Sum(i => i.Total)
            };
        }
    }
}
