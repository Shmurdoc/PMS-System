using System.Globalization;

namespace Aquri.Application.AiChat
{
    /// <summary>
    /// Keyword intent router ported from the AI tab's original client-side answers —
    /// every number comes from ChatStats, so replies reflect the seeded database.
    /// </summary>
    public class DeterministicChatClient : IAiChatClient
    {
        private readonly ChatStatsProvider _stats;

        public DeterministicChatClient(ChatStatsProvider stats) => _stats = stats;

        public async Task<ChatResponse> RespondAsync(string message, CancellationToken cancellationToken = default)
        {
            var stats = await _stats.GetAsync(cancellationToken);
            var q = message.ToLowerInvariant();

            if (q.Contains("occupancy") || q.Contains("occupied"))
                return Reply("occupancy", Occupancy(stats));
            if (q.Contains("revenue") || q.Contains("money") || q.Contains("income") || q.Contains("earnings"))
                return Reply("revenue", Revenue(stats));
            if (q.Contains("guest") || q.Contains("customer"))
                return Reply("guest", Guests(stats));
            if (q.Contains("booking") || q.Contains("reservation"))
                return Reply("booking", Bookings(stats));
            if (q.Contains("room") || q.Contains("available") || q.Contains("vacancy"))
                return Reply("room", Rooms(stats));
            if (q.Contains("staff") || q.Contains("employee") || q.Contains("schedule"))
                return Reply("staff", Staff(stats));
            if (q.Contains("price") || q.Contains("rate") || q.Contains("pricing"))
                return Reply("price", Pricing(stats));
            if (q.Contains("forecast") || q.Contains("predict") || q.Contains("trend"))
                return Reply("forecast", Forecast(stats));
            if (q.Contains("invoice") || q.Contains("payment") || q.Contains("billing"))
                return Reply("invoice", Invoices(stats));
            if (q.Contains("help") || q.Contains("what can"))
                return Reply("help", Help());

            return Reply("default", Default(stats));
        }

        private static ChatResponse Reply(string intent, string reply) =>
            new() { Reply = reply, Source = "deterministic", Intent = intent };

        private static string Money(decimal amount) =>
            $"R {amount.ToString("N2", CultureInfo.GetCultureInfo("en-ZA"))}";

        private static string Occupancy(ChatStats s) =>
            $"Current Occupancy: {s.OccupancyRate}% ({s.OccupiedRooms} of {s.TotalRooms} rooms occupied). " +
            $"{s.AvailableRooms} rooms are available. Based on booking trends, I predict occupancy will reach " +
            $"{Math.Min(s.OccupancyRate + 8, 100)}% by end of this week.";

        private static string Revenue(ChatStats s) =>
            $"Total booking revenue: {Money(s.TotalRevenue)}. Paid invoices total: {Money(s.PaidRevenue)}. " +
            $"Average rate per night: {Money(s.AvgRoomRate)}. Active bookings: {s.ActiveBookings}. " +
            "I recommend focusing on upselling suites which have the highest margin.";

        private static string Guests(ChatStats s) =>
            $"Total guests in system: {s.TotalGuests}. VIP guests: {s.VipGuests}. Corporate guests: {s.CorporateGuests}. " +
            $"Active check-ins: {s.CheckedInBookings}. Guest satisfaction is tracking well based on recent booking patterns.";

        private static string Bookings(ChatStats s) =>
            $"Total bookings: {s.TotalBookings}. Active/confirmed: {s.ActiveBookings}. Pending: {s.PendingBookings}. " +
            $"Cancelled: {s.CancelledBookings}. Checked-out: {s.CheckedOutBookings}. " +
            $"Upcoming bookings look strong with {s.ConfirmedBookings} confirmed.";

        private static string Rooms(ChatStats s)
        {
            var typeSummary = string.Join(", ", s.RoomTypes.Select(rt => $"{rt.Type}: {rt.Count}"));
            return $"Total rooms: {s.TotalRooms}. Available: {s.AvailableRooms}. Occupied: {s.OccupiedRooms}. " +
                   $"Maintenance: {s.MaintenanceRooms}. Cleaning: {s.CleaningRooms}. Room types: {typeSummary}.";
        }

        private static string Staff(ChatStats s) =>
            $"Based on current {s.OccupancyRate}% occupancy, I recommend " +
            (s.OccupancyRate > 80
                ? "adding 2 extra housekeeping staff for peak hours"
                : "maintaining current staffing levels") +
            ". Consider cross-training front desk staff for concierge duties during low-traffic periods.";

        private static string Pricing(ChatStats s) =>
            $"Average nightly rate: {Money(s.AvgRoomRate)}. At {s.OccupancyRate}% occupancy, " +
            (s.OccupancyRate > 85
                ? "there is room to increase rates by 10-15% on premium rooms"
                : "current rates are well-positioned for market conditions") +
            ". Weekend rates can be optimized for higher yield.";

        private static string Forecast(ChatStats s) =>
            $"Based on {s.TotalBookings} historical bookings: projected occupancy next week is " +
            $"{Math.Min(s.OccupancyRate + 5, 98)}%. Revenue trend is {(s.TotalRevenue > 50000 ? "positive" : "stable")}. " +
            "Peak demand expected on weekends. Consider running a mid-week promotion to boost occupancy.";

        private static string Invoices(ChatStats s) =>
            $"Total invoices: {s.TotalInvoices}. Pending: {s.PendingInvoices}. Overdue: {s.OverdueInvoices}. " +
            $"Paid: {s.PaidInvoices}. Total collected: {Money(s.PaidRevenue)}. " +
            (s.OverdueInvoices > 0
                ? "Action needed: follow up on overdue invoices."
                : "All invoices are current.");

        private static string Help() =>
            "I can help with: occupancy analysis, revenue reports, guest insights, booking status, " +
            "room availability, staffing recommendations, pricing optimization, demand forecasting, " +
            "invoice/payment tracking, and more. Just ask!";

        private static string Default(ChatStats s) =>
            $"I've analyzed your query against current property data. We have {s.OccupancyRate}% occupancy, " +
            $"{Money(s.TotalRevenue)} in bookings, and {s.TotalGuests} guests. Try asking about specific topics " +
            "like \"revenue\", \"occupancy\", \"guests\", \"bookings\", \"rooms\", \"pricing\", \"forecast\", " +
            "or \"invoices\" for detailed insights.";
    }
}
