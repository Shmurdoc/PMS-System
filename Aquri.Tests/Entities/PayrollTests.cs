using Aquri.Domain.Entities;
using Aquri.Domain.Exceptions;
using Aquri.Domain.Payroll;
using FluentAssertions;
using Xunit;

namespace Aquri.Tests.Entities
{
    public class PayrollTests
    {
        private static EmployeeCompensation Comp(
            string payType = "salary",
            decimal baseAmount = 20000m,
            decimal multiplier = 1.5m,
            decimal hours = 173.33m,
            decimal allowances = 0m,
            decimal otherDeductions = 0m,
            int userId = 7) =>
            new(1, userId, "Front Desk", payType, baseAmount, multiplier, hours, new DateTime(2026, 1, 1), allowances, otherDeductions);

        private static PayrollRun NewRun() =>
            new(1, new DateTime(2026, 10, 1), new DateTime(2026, 10, 31), "manager@nexus.com");

        private static Payslip Slip(PayrollRun run, EmployeeCompensation comp, decimal hours, decimal overtime = 0m) =>
            new(1, run.Id, comp, hours, overtime, comp.Allowances, comp.OtherDeductions);

        [Fact]
        public void Salary_PaysGrossMinusStatutoryDeductions()
        {
            var run = NewRun();
            var slip = Slip(run, Comp(), 173.33m);

            slip.BaseAmount.Should().Be(20000m);
            slip.GrossPay.Should().Be(20000m);
            slip.Paye.Should().Be(2183.08m);
            slip.Uif.Should().Be(177.12m);
            slip.TotalDeductions.Should().Be(2360.20m);
            slip.NetPay.Should().Be(17639.80m);
        }

        [Fact]
        public void SalaryOvertime_UsesDerivedHourlyRate()
        {
            var run = NewRun();
            var slip = Slip(run, Comp(), 183.33m, overtime: 10m);

            // 20000 / 173.33 = 115.39 per hour, times 1.5, times 10 hours.
            slip.OvertimeAmount.Should().Be(1730.85m);
            slip.GrossPay.Should().Be(21730.85m);
        }

        [Fact]
        public void HourlyStaff_AreCappedAtContractedHours()
        {
            var run = NewRun();
            var slip = Slip(run, Comp("hourly", 100m, hours: 173.33m), 200m, overtime: 26.67m);

            slip.BaseAmount.Should().Be(17333m);
            slip.OvertimeAmount.Should().Be(4000.50m);
            slip.GrossPay.Should().Be(21333.50m);
        }

        [Fact]
        public void Allowances_AddToGrossAndDeductions_ReduceNet()
        {
            var run = NewRun();
            var slip = Slip(run, Comp(allowances: 1500m, otherDeductions: 500m), 173.33m);

            slip.GrossPay.Should().Be(21500m);
            slip.TotalDeductions.Should().Be(PayrollTaxTables.MonthlyPaye(21500m) + PayrollTaxTables.MonthlyUif(21500m) + 500m);
            slip.NetPay.Should().Be(slip.GrossPay - slip.TotalDeductions);
        }

        [Fact]
        public void DeductionsAboveGross_AreRejected()
        {
            var run = NewRun();
            var act = () => Slip(run, Comp(baseAmount: 400m, otherDeductions: 600m), 173.33m);

            act.Should().Throw<DomainException>().WithMessage("*exceed gross*");
        }

        [Fact]
        public void OvertimeCannotExceedTotalHours()
        {
            var run = NewRun();
            var act = () => Slip(run, Comp(), 10m, overtime: 12m);

            act.Should().Throw<DomainException>().WithMessage("*cannot exceed*");
        }

        [Fact]
        public void RunTotals_ComeFromTheSlips()
        {
            var run = NewRun();
            run.AddPayslip(Slip(run, Comp(), 173.33m));
            run.AddPayslip(Slip(run, Comp(baseAmount: 12000m, userId: 8), 173.33m));

            run.EmployeeCount.Should().Be(2);
            run.TotalGross.Should().Be(run.Payslips.Sum(p => p.GrossPay));
            run.TotalNet.Should().Be(run.Payslips.Sum(p => p.NetPay));
        }

        [Fact]
        public void DuplicateEmployee_IsRejected()
        {
            var run = NewRun();
            run.AddPayslip(Slip(run, Comp(), 173.33m));

            var act = () => run.AddPayslip(Slip(run, Comp(), 173.33m));

            act.Should().Throw<DomainException>().WithMessage("*already has a payslip*");
        }

        [Fact]
        public void Approve_ByCreator_IsRejected()
        {
            var run = NewRun();
            run.AddPayslip(Slip(run, Comp(), 173.33m));

            var act = () => run.Approve("manager@nexus.com");

            act.Should().Throw<DomainException>().WithMessage("*someone other than*");
        }

        [Fact]
        public void Approve_WithoutPayslips_IsRejected()
        {
            var run = NewRun();

            var act = () => run.Approve("admin@nexus.com");

            act.Should().Throw<DomainException>().WithMessage("*without payslips*");
        }

        [Fact]
        public void Approve_BySecondPerson_FreezesTheRun()
        {
            var run = NewRun();
            run.AddPayslip(Slip(run, Comp(), 173.33m));

            run.Approve("admin@nexus.com");

            run.Status.Should().Be("approved");
            run.ApprovedBy.Should().Be("admin@nexus.com");
            run.ApprovedAt.Should().NotBeNull();
            run.IsEditable.Should().BeFalse();
        }

        [Fact]
        public void ApprovedRun_RejectsNewPayslips()
        {
            var run = NewRun();
            run.AddPayslip(Slip(run, Comp(), 173.33m));
            run.Approve("admin@nexus.com");

            var act = () => run.AddPayslip(Slip(run, Comp(baseAmount: 9000m), 173.33m));

            act.Should().Throw<DomainException>().WithMessage("*Cannot add*");
        }

        [Fact]
        public void Pay_RequiresApproval_AndIsTerminal()
        {
            var run = NewRun();
            run.AddPayslip(Slip(run, Comp(), 173.33m));

            var tooEarly = () => run.MarkPaid("admin@nexus.com");
            tooEarly.Should().Throw<DomainException>().WithMessage("*Only an approved run*");

            run.Approve("admin@nexus.com");
            run.MarkPaid("admin@nexus.com");

            run.Status.Should().Be("paid");
            run.PaidBy.Should().Be("admin@nexus.com");
            run.PaidAt.Should().NotBeNull();
        }

        [Fact]
        public void PaidRun_CannotBeCancelled()
        {
            var run = NewRun();
            run.AddPayslip(Slip(run, Comp(), 173.33m));
            run.Approve("admin@nexus.com");
            run.MarkPaid("admin@nexus.com");

            var act = () => run.Cancel("mistake");

            act.Should().Throw<DomainException>().WithMessage("*cannot be cancelled*");
        }

        [Fact]
        public void Cancel_RequiresReason()
        {
            var run = NewRun();

            var act = () => run.Cancel("  ");

            act.Should().Throw<ArgumentException>();
        }

        [Fact]
        public void InvalidPeriods_AreRejected()
        {
            var backwards = () => new PayrollRun(1, new DateTime(2026, 11, 1), new DateTime(2026, 10, 1), "admin");
            backwards.Should().Throw<DomainException>();

            var tooLong = () => new PayrollRun(1, new DateTime(2026, 1, 1), new DateTime(2026, 6, 1), "admin");
            tooLong.Should().Throw<DomainException>().WithMessage("*cannot exceed*");
        }

        [Fact]
        public void TaxTables_AreAppliedConsistently()
        {
            PayrollTaxTables.MonthlyPaye(20000m).Should().Be(2183.08m);
            PayrollTaxTables.MonthlyPaye(5000m).Should().BeLessThan(PayrollTaxTables.MonthlyPaye(20000m));
            PayrollTaxTables.MonthlyUif(20000m).Should().Be(177.12m);
            PayrollTaxTables.MonthlyUif(500000m).Should().Be(177.12m);
            Money.Round(2.345m).Should().Be(2.35m);
        }
    }
}
