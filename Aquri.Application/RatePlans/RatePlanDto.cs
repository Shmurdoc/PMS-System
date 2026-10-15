using System;
using Aquri.Domain.Entities;

namespace Aquri.Application.RatePlans
{
    /// <summary>Pricing plan as returned by the API — shaped for the frontend rate-plan list.</summary>
    public class RatePlanDto
    {
        public int Id { get; init; }
        public int PropertyId { get; init; }
        public string Name { get; init; } = string.Empty;
        public string[] RoomTypes { get; init; } = Array.Empty<string>();
        public decimal BaseRate { get; init; }
        public string Season { get; init; } = "low";
        public int MinStay { get; init; }
        public bool Active { get; init; }
        public string[] Restrictions { get; init; } = Array.Empty<string>();
        public DateTime Created { get; init; }
        public DateTime LastModified { get; init; }

        public static RatePlanDto FromEntity(RatePlan plan) => new()
        {
            Id = plan.Id,
            PropertyId = plan.PropertyId,
            Name = plan.Name,
            RoomTypes = plan.RoomTypes,
            BaseRate = plan.BaseRate,
            Season = plan.Season,
            MinStay = plan.MinStay,
            Active = plan.Active,
            Restrictions = plan.Restrictions,
            Created = plan.Created,
            LastModified = plan.LastModified
        };
    }
}
