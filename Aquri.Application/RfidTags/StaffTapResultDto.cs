namespace Aquri.Application.RfidTags
{
    /// <summary>Outcome of a staff badge tap: which way the attendance toggle flipped.</summary>
    public class StaffTapResultDto
    {
        /// <summary>in | out.</summary>
        public string Punch { get; init; } = string.Empty;

        public int AttendanceId { get; init; }
        public int UserId { get; init; }
        public string UserName { get; init; } = string.Empty;
        public string TagNumber { get; init; } = string.Empty;
        public DateTime CheckIn { get; init; }
        public DateTime? CheckOut { get; init; }
    }
}
