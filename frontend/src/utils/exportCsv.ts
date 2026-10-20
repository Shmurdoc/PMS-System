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
