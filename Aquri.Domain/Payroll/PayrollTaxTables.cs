using System;

namespace Aquri.Domain.Payroll
{
    /// <summary>
    /// Statutory deduction tables. Tax years change, so every constant a finance
    /// team would need to update lives here and nowhere else. Amounts are annual
    /// rand figures; <see cref="MonthlyPaye"/> de-annualises them.
    /// </summary>
    public static class PayrollTaxTables
    {
        /// <summary>Stamped on every payslip so a stored slip always names its table.</summary>
        public const string TaxYear = "2024/2025";

        /// <summary>Employee UIF contribution rate.</summary>
        public const decimal UifRate = 0.01m;

        /// <summary>Monthly earnings ceiling for UIF. Contributions stop above this.</summary>
        public const decimal UifMonthlyCeiling = 17712m;

        /// <summary>Primary rebate, applied once against the annual PAYE figure.</summary>
        public const decimal PrimaryRebate = 17235m;

        /// <summary>
        /// Annual PAYE brackets. <c>From</c> is the exclusive lower edge,
        /// <c>Rate</c> the marginal rate, and <c>Base</c> the tax already owed
        /// at that edge.
        /// </summary>
        public static readonly Bracket[] Brackets =
        {
            new(0m, 237100m, 0.18m, 0m),
            new(237100m, 370500m, 0.26m, 42678m),
            new(370500m, 512800m, 0.31m, 77362m),
            new(512800m, 673000m, 0.36m, 121475m),
            new(673000m, 857900m, 0.39m, 179147m),
            new(857900m, 1817000m, 0.41m, 251258m),
            new(1817000m, decimal.MaxValue, 0.45m, 644489m),
        };

        public readonly record struct Bracket(decimal From, decimal UpTo, decimal Rate, decimal Base);

        /// <summary>Annual PAYE on taxable income, before rebates.</summary>
        public static decimal AnnualPaye(decimal annualTaxable)
        {
            if (annualTaxable <= 0m)
                return 0m;

            foreach (var bracket in Brackets)
            {
                if (annualTaxable <= bracket.UpTo)
                    return bracket.Base + (annualTaxable - bracket.From) * bracket.Rate;
            }

            return 0m;
        }

        /// <summary>Monthly PAYE after the primary rebate. Never negative.</summary>
        public static decimal MonthlyPaye(decimal monthlyTaxable)
        {
            if (monthlyTaxable <= 0m)
                return 0m;

            var annual = AnnualPaye(monthlyTaxable * 12m) - PrimaryRebate;
            if (annual <= 0m)
                return 0m;

            return Money.Round(annual / 12m);
        }

        /// <summary>Monthly UIF, capped at the statutory ceiling.</summary>
        public static decimal MonthlyUif(decimal monthlyGross)
        {
            if (monthlyGross <= 0m)
                return 0m;

            var contributable = Math.Min(monthlyGross, UifMonthlyCeiling);
            return Money.Round(contributable * UifRate);
        }
    }

    /// <summary>Single rounding rule for payroll money: two decimals, half away from zero.</summary>
    public static class Money
    {
        public static decimal Round(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);
    }
}
