namespace Aquri.Application.RfidTags
{
    /// <summary>Read-only context returned for a guest tag tap: who they are, where they are staying, and whether the booking is still valid. Writes nothing.</summary>
    public class GuestTapContextDto
    {
        public int TagId { get; init; }
        public string TagNumber { get; init; } = string.Empty;
        public string AccessLevel { get; init; } = string.Empty;
        public DateTime? ExpiresAt { get; init; }

        public int BookingId { get; init; }
        public int GuestId { get; init; }
        public string GuestName { get; init; } = string.Empty;
        public int RoomId { get; init; }
        public string RoomNumber { get; init; } = string.Empty;

        /// <summary>Booking status on the wire (confirmed | checked_in | ...).</summary>
        public string BookingStatus { get; init; } = string.Empty;

        public DateTime CheckIn { get; init; }
        public DateTime CheckOut { get; init; }
    }
}
