import type { AnalysisQuery } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { historicalPostedLocal, ledgerFields, ledgerFrom, validReportTime } from '../reports/sql.ts';
import { normalizeEvent } from '../reports/normalize.ts';
import { snapshotLocalTime, type ReportSnapshot } from '../reports/snapshot.ts';

const compactable = `s.source_id IS NOT NULL AND s.operation_id IS NULL AND s.correction_id IS NULL
  AND (s.source_order_no IS NULL OR s.source_order_no='') AND s.inbound_receipt_id IS NULL AND s.order_id IS NULL`;
const validPosted = validReportTime('reportLocalTime');
const validBusiness = validReportTime("CONCAT(businessDay,' 00:00:00')");
const linkedFields = ledgerFields.replace(/,\s*c\.original_operation_id AS originalOperationId$/, '');

// Reduce additive history before joining. FIFO and balance-chain evidence stay in the report projection.
// MySQL's unbounded LIMIT prevents condition pushdown from re-parsing each raw JSON timestamp for validation.
const source = `WITH history AS (
  SELECT CAST(${historicalPostedLocal} AS CHAR(32)) COLLATE utf8mb4_0900_bin AS reportLocalTime,
    s.product_code AS productCode,s.source_business_type,MIN(s.id) AS id,
    SUM(s.packages_delta) AS packages_delta,SUM(s.tonnes_delta) AS tonnes_delta
  FROM stock_journal s
  WHERE s.source_del_flag=0 AND s.id<=? AND (${compactable})
  GROUP BY reportLocalTime,s.product_code,s.source_business_type
  LIMIT 18446744073709551615
), linked AS (
  SELECT /*+ NO_BNL(p,w,o) */ STRAIGHT_JOIN ${linkedFields} ${ledgerFrom}
  WHERE s.source_del_flag=0 AND s.id<=? AND NOT (${compactable})
), movements AS (
  SELECT id,reportLocalTime,productCode,NULL AS documentPartyCode,NULL AS documentId,
    NULL AS businessDay,NULL AS operation_type,source_business_type,'historical' AS source_id,
    NULL AS correctionInboundId,NULL AS correctionOutboundId,packages_delta,tonnes_delta
  FROM history JOIN master_products p ON p.code=history.productCode AND p.inventory_eligible=1
  UNION ALL
  SELECT id,reportLocalTime,productCode,
    COALESCE(documentPartyCode,JSON_VALUE(documentSource,'$.customer_code' NULL ON EMPTY NULL ON ERROR),
      JSON_VALUE(documentSource,'$.supplier_code' NULL ON EMPTY NULL ON ERROR)),documentId,
    COALESCE(documentBusinessDate,JSON_VALUE(documentSource,'$.inbound_date' NULL ON EMPTY NULL ON ERROR),
      JSON_VALUE(documentSource,'$.outbound_date' NULL ON EMPTY NULL ON ERROR)),
    operation_type,source_business_type,source_id,correctionInboundId,correctionOutboundId,packages_delta,tonnes_delta
  FROM linked
), dated AS (
  SELECT *,CASE WHEN ${validPosted} THEN reportLocalTime ELSE NULL END AS posted,
    CASE WHEN ${validBusiness} THEN businessDay ELSE NULL END AS business,
    CASE WHEN COALESCE(operation_type,source_business_type) IN ('inbound','inbound.confirm','inbound.reverse')
      OR (operation_type='stock.correct' AND correctionInboundId IS NOT NULL) THEN 'inbound' ELSE 'outbound' END AS family
  FROM movements
), corrections AS (
  SELECT document_kind,document_id,after_date,
    ROW_NUMBER() OVER (PARTITION BY document_kind,document_id ORDER BY revision DESC) AS position
  FROM document_date_corrections WHERE created_at<=?
), daily AS (
  SELECT d.*,CASE WHEN ?='posted' THEN LEFT(posted,10)
    WHEN business IS NOT NULL THEN COALESCE(c.after_date,business) ELSE NULL END AS day
  FROM dated d LEFT JOIN corrections c ON c.document_kind=d.family AND c.document_id=d.documentId AND c.position=1
  WHERE (posted IS NULL OR posted<=?)
)`;

export async function movementGroups(db: Database, query: AnalysisQuery, snapshot: ReportSnapshot) {
  const rows = await db.all(
    `${source}
    SELECT MIN(id) AS id,CONCAT(day,' 00:00:00') AS reportLocalTime,productCode,documentPartyCode,
      operation_type,source_business_type,IF(source_id IS NULL,NULL,'historical') AS source_id,
      IF(correctionInboundId IS NULL,NULL,'inbound') AS correctionInboundId,
      IF(correctionOutboundId IS NULL,NULL,'outbound') AS correctionOutboundId,
      SUM(packages_delta) AS packages_delta,SUM(tonnes_delta) AS tonnes_delta,
      CAST(0 AS DECIMAL(18,4)) AS correctionOffsetTonnes
    FROM daily GROUP BY day,productCode,documentPartyCode,operation_type,source_business_type,
      IF(source_id IS NULL,NULL,'historical'),IF(correctionInboundId IS NULL,NULL,'inbound'),
      IF(correctionOutboundId IS NULL,NULL,'outbound')`,
    [
      snapshot.watermarks.journalMaxId,
      snapshot.watermarks.journalMaxId,
      snapshot.watermarks.asOf.replace('T', ' ').replace('Z', ''),
      query.basis,
      snapshotLocalTime(snapshot),
    ],
  );
  return rows.map(normalizeEvent);
}
