import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 11,
    color: '#1f2933'
  },
  header: {
    marginBottom: 20
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 6
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 6
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  divider: {
    height: 1,
    backgroundColor: '#e4e7eb',
    marginVertical: 12
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#d9e2ec',
    paddingBottom: 6,
    marginBottom: 6
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4
  },
  colDesc: { flex: 3 },
  colQty: { flex: 1, textAlign: 'right' },
  colPrice: { flex: 1.5, textAlign: 'right' },
  colTotal: { flex: 1.5, textAlign: 'right' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6
  },
  muted: {
    color: '#52606d'
  }
});

const ReceiptTemplate = ({ data }: { data: Record<string, any> }) => {
  const { company, guest, bookingId, room, checkIn, checkOut, items, taxes, subtotal, total } = data;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Receipt</Text>
          <Text>{company?.name}</Text>
          <Text style={styles.muted}>{company?.address}</Text>
          <Text style={styles.muted}>{company?.email} | {company?.phone}</Text>
          <Text style={styles.muted}>Tax ID: {company?.taxId} | Reg: {company?.registrationNumber}</Text>
        </View>

        <View>
          <Text style={styles.sectionTitle}>Guest & Stay Details</Text>
          <View style={styles.row}><Text style={styles.muted}>Guest</Text><Text>{guest}</Text></View>
          <View style={styles.row}><Text style={styles.muted}>Booking ID</Text><Text>{bookingId}</Text></View>
          <View style={styles.row}><Text style={styles.muted}>Room</Text><Text>{room}</Text></View>
          <View style={styles.row}><Text style={styles.muted}>Dates</Text><Text>{checkIn} to {checkOut}</Text></View>
        </View>

        <View style={styles.divider} />

        <View>
          <Text style={styles.sectionTitle}>Charges</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.colDesc}>Description</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colPrice}>Unit</Text>
            <Text style={styles.colTotal}>Total</Text>
          </View>
          {items?.map((item: any, index: number) => (
            <View key={index} style={styles.tableRow}>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colPrice}>{item.unitPrice.toFixed(2)}</Text>
              <Text style={styles.colTotal}>{item.total.toFixed(2)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.divider} />

        <View>
          <View style={styles.totalRow}>
            <Text style={styles.muted}>Subtotal</Text>
            <Text>{subtotal.toFixed(2)}</Text>
          </View>
          {taxes?.map((tax: any, index: number) => (
            <View key={index} style={styles.totalRow}>
              <Text style={styles.muted}>{tax.label}</Text>
              <Text>{tax.amount.toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.sectionTitle}>Total</Text>
            <Text style={styles.sectionTitle}>{total.toFixed(2)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default ReceiptTemplate;
