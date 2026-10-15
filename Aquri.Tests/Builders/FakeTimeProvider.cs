using System;

namespace Aquri.Tests.Builders
{
    /// <summary>
    /// Fake time provider that allows deterministic time in tests.
    /// </summary>
    public class FakeTimeProvider
    {
        private DateTime _currentTime;

        /// <summary>
        /// Creates a new FakeTimeProvider with the current system time as the base
        /// </summary>
        public FakeTimeProvider()
        {
            _currentTime = DateTime.UtcNow;
        }

        /// <summary>
        /// Creates a new FakeTimeProvider with a specific base time
        /// </summary>
        /// <param name="baseTime">The base time to use</param>
        public FakeTimeProvider(DateTime baseTime)
        {
            _currentTime = baseTime;
        }

        /// <summary>
        /// Gets the current UTC time
        /// </summary>
        public DateTime GetCurrentTime() => _currentTime;

        /// <summary>
        /// Advances the current time by the specified offset
        /// </summary>
        /// <param name="offset">The time offset to add</param>
        public void Add(TimeSpan offset) => _currentTime = _currentTime.Add(offset);

        /// <summary>
        /// Resets the time to the original base time
        /// </summary>
        public void Reset() => _currentTime = DateTime.UtcNow;

        /// <summary>
        /// Gets the current time as a DateTimeOffset
        /// </summary>
        public DateTimeOffset GetCurrentTimeOffset() => _currentTime;

        public override bool Equals(object? obj)
        {
            return obj is FakeTimeProvider other && _currentTime == other._currentTime;
        }

        public override int GetHashCode() => _currentTime.GetHashCode();

        public override string ToString() => _currentTime.ToString("o");
    }
}