using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace Aquri.Application.AiAgents
{
    /// <summary>Insight text plus the log line a run writes — both computed from live tables.</summary>
    public record GeneratedInsight(
        string Type,
        string Title,
        string Description,
        string Recommendation,
        string Impact,
        string LogMessage);

    /// <summary>
    /// One deterministic generator per agent key (spec §6). Each reads the tables it
    /// owns and frames a single recommendation — no LLM in v1, so runs stay testable offline.
    /// </summary>
    public class AgentInsightGenerator
    {
        private readonly IApplicationDbContext _context;

        public AgentInsightGenerator(IApplicationDbContext context) => _context = context;

        public async Task<GeneratedInsight?> GenerateAsync(string key, CancellationToken cancellationToken = default)
        {
            return key switch
            {
                "revenue-optimizer" => await RevenueOptimizer(cancellationToken),
                "guest-predictor" => await GuestPredictor(cancellationToken),
                "maintenance-scheduler" => await MaintenanceScheduler(cancellationToken),
                "rate-analyzer" => await RateAnalyzer(cancellationToken),
                "staffing-optimizer" => await StaffingOptimizer(cancellationToken),
                "inventory-monitor" => await InventoryMonitor(cancellationToken),
                _ => null
            };
        }

        private async Task<GeneratedInsight> RevenueOptimizer(CancellationToken cancellationToken)
        {
            var bookings = await _context.Bookings.AsNoTracking().ToListAsync(cancellationToken);
            var rooms = await _context.Rooms.AsNoTracking().ToListAsync(cancellationToken);

            var active = bookings.Where(b => b.Status != BookingStatus.Cancelled).ToList();
            var revenue = active.Sum(b => b.Amount);
            var nights = active.Sum(b => b.Nights);
            var avgRate = nights > 0 ? Math.Round(revenue / nights, 0, MidpointRounding.AwayFromZero) : 0m;
            var occupancy = rooms.Count > 0
                ? (int)Math.Round(active.Count * 100.0 / rooms.Count, MidpointRounding.AwayFromZero)
                : 0;

            return new GeneratedInsight(
                "revenue",
                "Rate adjustment opportunity",
                $"{active.Count} active bookings generate {Money(revenue)} at an average nightly rate of {Money(avgRate)} across {rooms.Count} rooms.",
                occupancy >= 80
                    ? "Raise standard-room rates 8-12% while demand holds."
                    : "Hold current rates and push mid-week promotions to fill shoulder nights.",
                occupancy >= 80 ? "high" : "medium",
                $"Analyzed {active.Count} bookings, revenue {Money(revenue)}, average rate {Money(avgRate)}");
        }

        private async Task<GeneratedInsight> GuestPredictor(CancellationToken cancellationToken)
        {
            var guests = await _context.Guests.AsNoTracking().ToListAsync(cancellationToken);
            var vip = guests.Count(g => g.Segment == "VIP");
            var corporate = guests.Count(g => g.Segment == "Corporate");

            return new GeneratedInsight(
                "guest",
                "Guest satisfaction forecast",
                $"Tracking {guests.Count} guests — {vip} VIP and {corporate} corporate.",
                vip > 0
                    ? "Review VIP folios before checkout; this segment carries the highest repeat-visit likelihood."
                    : "Collect post-stay feedback from first-time guests to build preference models.",
                vip >= 5 ? "medium" : "low",
                $"Processed {guests.Count} guest profiles, {vip} VIP flagged");
        }

        private async Task<GeneratedInsight> MaintenanceScheduler(CancellationToken cancellationToken)
        {
            var requests = await _context.MaintenanceRequests.AsNoTracking()
                .Where(r => r.Status != "completed")
                .ToListAsync(cancellationToken);
            var highPriority = requests.Count(r => r.Priority == "high");

            return new GeneratedInsight(
                "maintenance",
                "High-priority maintenance queue",
                $"{requests.Count} open request{(requests.Count == 1 ? "" : "s")}, {highPriority} at high priority.",
                highPriority > 0
                    ? "Schedule high-priority work this week and batch room-entry tasks to cut downtime."
                    : "No high-priority work queued — plan preventive inspections for the quiet period.",
                highPriority > 0 ? "high" : "low",
                $"{requests.Count} open maintenance requests, {highPriority} high priority");
        }

        private async Task<GeneratedInsight> RateAnalyzer(CancellationToken cancellationToken)
        {
            var bookings = await _context.Bookings.AsNoTracking().ToListAsync(cancellationToken);
            var rooms = await _context.Rooms.AsNoTracking().ToListAsync(cancellationToken);

            var nights = bookings.Sum(b => b.Nights);
            var avgRate = nights > 0
                ? Math.Round(bookings.Sum(b => b.Amount) / nights, 0, MidpointRounding.AwayFromZero)
                : 0m;
            var occupancy = rooms.Count > 0
                ? (int)Math.Round(rooms.Count(r => r.Status == RoomStatus.Occupied) * 100.0 / rooms.Count, MidpointRounding.AwayFromZero)
                : 0;

            return new GeneratedInsight(
                "revenue",
                "Rate positioning review",
                $"Average nightly rate {Money(avgRate)} against {occupancy}% occupancy.",
                occupancy > 85
                    ? "Demand is ahead of price — lift suite rates toward market."
                    : occupancy < 50
                        ? "Occupancy is soft — a promotional rate should stimulate demand."
                        : "Rates sit well against current demand; hold positioning.",
                occupancy > 85 || occupancy < 50 ? "high" : "medium",
                $"Compared average rate {Money(avgRate)} with {occupancy}% occupancy");
        }

        private async Task<GeneratedInsight> StaffingOptimizer(CancellationToken cancellationToken)
        {
            var rooms = await _context.Rooms.AsNoTracking().ToListAsync(cancellationToken);
            var occupied = rooms.Count(r => r.Status == RoomStatus.Occupied);
            var occupancy = rooms.Count > 0
                ? (int)Math.Round(occupied * 100.0 / rooms.Count, MidpointRounding.AwayFromZero)
                : 0;

            return new GeneratedInsight(
                "staffing",
                "Housekeeping staffing recommendation",
                $"{occupied} of {rooms.Count} rooms occupied ({occupancy}%).",
                occupancy > 80
                    ? "Add two housekeeping shifts for peak hours while occupancy runs this high."
                    : "Current rosters cover demand — keep flex staff on call.",
                occupancy > 80 ? "high" : "low",
                occupancy > 80
                    ? $"Occupancy {occupancy}% — recommended extra housekeeping cover"
                    : $"Occupancy {occupancy}% — staffing held steady");
        }

        private async Task<GeneratedInsight> InventoryMonitor(CancellationToken cancellationToken)
        {
            var items = await _context.InventoryItems.AsNoTracking().ToListAsync(cancellationToken);
            var belowReorder = items.Where(i => i.NeedsReorder).ToList();
            var names = string.Join(", ", belowReorder.Take(3).Select(i => i.Name));

            return new GeneratedInsight(
                "operational",
                "Reorder alert",
                belowReorder.Count == 0
                    ? $"All {items.Count} tracked items sit above their reorder levels."
                    : $"{belowReorder.Count} of {items.Count} items at or below reorder level: {names}.",
                belowReorder.Count > 0
                    ? "Raise purchase orders for the flagged items before stock runs short."
                    : "No purchasing action needed this cycle.",
                belowReorder.Count >= 3 ? "high" : belowReorder.Count > 0 ? "medium" : "low",
                $"Scanned {items.Count} inventory items, {belowReorder.Count} below reorder level");
        }

        private static string Money(decimal amount) =>
            amount.ToString("N2", CultureInfo.GetCultureInfo("en-ZA"));
    }
}
