// Payroll transport types. Field names mirror the API DTOs one-for-one so a
// mismatch shows up as a TypeScript error rather than a blank cell on screen.

export interface ApiCompensation {
  id: number;
  propertyId: number;
  userId: number;
  userName: string;
  payType: 'salary' | 'hourly';
  baseAmount: number;
  overtimeMultiplier: number;
  standardHours: number;
  allowances: number;
  otherDeductions: number;
  hourlyRate: number;
  currency: string;
  effectiveFrom: string;
  active: boolean;
  created: string;
  lastModified: string;
}

export interface ApiPayslip {
  id: number;
  payrollRunId: number;
  propertyId: number;
  userId: number;
  userName: string;
  payType: 'salary' | 'hourly';
  baseRate: number;
  overtimeMultiplier: number;
  standardHours: number;
  hoursWorked: number;
  overtimeHours: number;
  baseAmount: number;
  overtimeAmount: number;
  allowances: number;
  grossPay: number;
  paye: number;
  uif: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
  currency: string;
  taxYear: string;
  created: string;
}

export interface ApiPayrollRun {
  id: number;
  propertyId: number;
  periodStart: string;
  periodEnd: string;
  status: 'draft' | 'approved' | 'paid' | 'cancelled';
  employeeCount: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  currency: string;
  createdBy: string;
  approvedBy?: string | null;
  paidBy?: string | null;
  cancellationReason?: string | null;
  created: string;
  lastModified: string;
  approvedAt?: string | null;
  paidAt?: string | null;
  payslips?: ApiPayslip[] | null;
}

export interface CreatePayrollRunInput {
  propertyId: number;
  periodStart: string;
  periodEnd: string;
  rebuildExisting?: boolean;
}

export interface UpsertCompensationInput {
  propertyId: number;
  userId: number;
  payType: 'salary' | 'hourly';
  baseAmount: number;
  overtimeMultiplier: number;
  standardHours: number;
  allowances: number;
  otherDeductions: number;
  effectiveFrom: string;
}
