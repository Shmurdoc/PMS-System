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
    marginBottom: 8
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  divider: {
    height: 1,
    backgroundColor: '#e4e7eb',
    marginVertical: 12
  },
  muted: {
    color: '#52606d'
  }
});

const ReportTemplate = ({ data }: { data: Record<string, any> }) => {
  const { title, period, summary } = data;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.muted}>Reporting Period: {period}</Text>
        </View>

        <View style={styles.divider} />

        <View>
          <Text style={styles.sectionTitle}>Summary</Text>
          {summary?.map((item: any, index: number) => (
            <View key={index} style={styles.row}>
              <Text style={styles.muted}>{item.label}</Text>
              <Text>{item.value}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
};

export default ReportTemplate;
