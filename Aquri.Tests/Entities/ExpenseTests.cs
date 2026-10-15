using Aquri.Domain.Entities;
using Aquri.Domain.Exceptions;
using FluentAssertions;
using Xunit;

namespace Aquri.Tests.Entities
{
    public class ExpenseTests
    {
        private static Expense NewExpense() =>
            new(1, "supplies", 250.50m, "Cleaning chemicals restock", DateTime.UtcNow, "housekeeping@nexus.com");

        [Fact]
        public void Constructor_PendingByDefault()
        {
            var expense = NewExpense();

            expense.Status.Should().Be("pending");
            expense.Amount.Should().Be(250.50m);
        }

        [Fact]
        public void Approve_Pending_SetsStatusAndApprover()
        {
            var expense = NewExpense();

            expense.Approve("manager@nexus.com");

            expense.Status.Should().Be("approved");
            expense.ApprovedBy.Should().Be("manager@nexus.com");
            expense.ApprovedAt.Should().NotBeNull();
        }

        [Fact]
        public void Approve_AlreadyApproved_Throws()
        {
            var expense = NewExpense();
            expense.Approve("manager@nexus.com");

            var act = () => expense.Approve("other@nexus.com");

            act.Should().Throw<DomainException>();
        }

        [Fact]
        public void Reject_Pending_SetsStatus()
        {
            var expense = NewExpense();

            expense.Reject("manager@nexus.com");

            expense.Status.Should().Be("rejected");
        }

        [Fact]
        public void SetPaymentMethod_Unknown_Throws()
        {
            var expense = NewExpense();

            var act = () => expense.SetPaymentMethod("crypto");

            act.Should().Throw<ArgumentException>();
        }
    }
}
