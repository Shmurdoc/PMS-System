export const exportToCsv = <T extends Record<string, unknown>>(
  data: T[],
  fileName: string,
  columns?: { key: keyof T; header: string }[]
): { blob: Blob; url: string } => {
  if (data.length === 0) {
    const emptyBlob = new Blob([''], { type: 'text/csv' });
    return { blob: emptyBlob, url: URL.createObjectURL(emptyBlob) };
  }

  const headers = columns
    ? columns.map(c => c.header)
    : Object.keys(data[0]);

  const keys = columns
    ? columns.map(c => c.key)
    : Object.keys(data[0]) as (keyof T)[];

  const csvRows = [
    headers.join(','),
    ...data.map(row =>
      keys.map(key => {
        const value = row[key];
        const stringValue = value === null || value === undefined ? '' : String(value);
        const escaped = stringValue.replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(',')
    )
  ];

  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return { blob, url };
};

export const exportFinancesToCsv = (transactions: {
  id: string;
  date: string;
  desc: string;
  category: string;
  amount: number;
  status: string;
}[]) => {
  return exportToCsv(transactions, `finances_${new Date().toISOString().split('T')[0]}`, [
    { key: 'id' as keyof typeof transactions[0], header: 'ID' },
    { key: 'date' as keyof typeof transactions[0], header: 'Date' },
    { key: 'desc' as keyof typeof transactions[0], header: 'Description' },
    { key: 'category' as keyof typeof transactions[0], header: 'Category' },
    { key: 'amount' as keyof typeof transactions[0], header: 'Amount' },
    { key: 'status' as keyof typeof transactions[0], header: 'Status' },
  ]);
};

export const exportInventoryToCsv = (items: {
  id: string;
  name: string;
  category: string;
  stock: number;
  min: number;
  value: number;
}[]) => {
  return exportToCsv(items, `inventory_${new Date().toISOString().split('T')[0]}`, [
    { key: 'id' as keyof typeof items[0], header: 'ID' },
    { key: 'name' as keyof typeof items[0], header: 'Name' },
    { key: 'category' as keyof typeof items[0], header: 'Category' },
    { key: 'stock' as keyof typeof items[0], header: 'Stock' },
    { key: 'min' as keyof typeof items[0], header: 'Min Level' },
    { key: 'value' as keyof typeof items[0], header: 'Value' },
  ]);
};

export const exportStaffToCsv = (staff: {
  id: string;
  name: string;
  role: string;
  rfid: string;
  status: string;
  checkIn: string;
}[]) => {
  return exportToCsv(staff, `staff_${new Date().toISOString().split('T')[0]}`, [
    { key: 'id' as keyof typeof staff[0], header: 'ID' },
    { key: 'name' as keyof typeof staff[0], header: 'Name' },
    { key: 'role' as keyof typeof staff[0], header: 'Role' },
    { key: 'rfid' as keyof typeof staff[0], header: 'RFID' },
    { key: 'status' as keyof typeof staff[0], header: 'Status' },
    { key: 'checkIn' as keyof typeof staff[0], header: 'Check-in Time' },
  ]);
};

export const exportElectricityToCsv = (records: {
  id: string;
  period: string;
  usage: number;
  rate: number;
  amount: number;
  status: string;
}[]) => {
  return exportToCsv(records, `electricity_${new Date().toISOString().split('T')[0]}`, [
    { key: 'id' as keyof typeof records[0], header: 'ID' },
    { key: 'period' as keyof typeof records[0], header: 'Period' },
    { key: 'usage' as keyof typeof records[0], header: 'Usage (kWh)' },
    { key: 'rate' as keyof typeof records[0], header: 'Rate' },
    { key: 'amount' as keyof typeof records[0], header: 'Amount (R)' },
    { key: 'status' as keyof typeof records[0], header: 'Status' },
  ]);
};