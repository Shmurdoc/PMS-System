using Aquri.Domain.Entities;
using FluentAssertions;
using Xunit;

namespace Aquri.Tests.Entities
{
    public class RatePlanTests
    {
        private static RatePlan NewPlan() =>
            new(1, "Summer Special", 1200m, "high", 2);

        [Fact]
        public void Constructor_Valid_ActiveByDefault()
        {
            var plan = NewPlan();

            plan.Name.Should().Be("Summer Special");
            plan.Season.Should().Be("high");
            plan.MinStay.Should().Be(2);
            plan.Active.Should().BeTrue();
        }

        [Fact]
        public void Constructor_UnknownSeason_Throws()
        {
            var act = () => new RatePlan(1, "Plan", 100m, "monsoon", 1);

            act.Should().Throw<ArgumentException>();
        }

        [Fact]
        public void Constructor_ZeroMinStay_Throws()
        {
            var act = () => new RatePlan(1, "Plan", 100m, "low", 0);

            act.Should().Throw<ArgumentException>();
        }

        [Fact]
        public void Deactivate_TurnsOff()
        {
            var plan = NewPlan();

            plan.Deactivate();

            plan.Active.Should().BeFalse();
        }

        [Fact]
        public void UpdateBaseRate_Negative_Throws()
        {
            var plan = NewPlan();

            var act = () => plan.UpdateBaseRate(-1m);

            act.Should().Throw<ArgumentException>();
        }
    }
}
