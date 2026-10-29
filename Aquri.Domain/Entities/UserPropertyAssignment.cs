using System;

namespace Aquri.Domain.Entities
{
    /// <summary>
    /// One property an employee is allowed to work in. A user can have several
    /// of these (a front desk clerk covering three hotels), and every scope
    /// check for a non-admin is a membership test against this set. Admins have
    /// no assignments and therefore see everything.
    /// </summary>
    public class UserPropertyAssignment
    {
        public int Id { get; private set; }

        public int UserId { get; private set; }

        /// <summary>Tenant id of the property (the value other rows store as PropertyId).</summary>
        public int PropertyId { get; private set; }

        public DateTime Created { get; private set; }

        /// <summary>EF Core parameterless constructor.</summary>
        public UserPropertyAssignment() { }

        public UserPropertyAssignment(int userId, int propertyId)
        {
            // A brand-new user has no id yet; EF fills the user FK on insert.
            // Negative ids are always a bug.
            if (userId < 0)
                throw new ArgumentException("UserId cannot be negative.", nameof(userId));
            if (propertyId <= 0)
                throw new ArgumentException("PropertyId must be positive.", nameof(propertyId));

            UserId = userId;
            PropertyId = propertyId;
            Created = DateTime.UtcNow;
        }
    }
}
