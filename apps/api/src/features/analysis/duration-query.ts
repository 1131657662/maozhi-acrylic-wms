// One aggregate within the analysis read snapshot; shipments are reduced per order before joining.
export const durationQuery = `WITH duration_period AS (SELECT ? AS start_at,? AS end_at,? AS as_of), pending AS (
      SELECT 'inbound' AS kind,r.receipt_no AS number,r.created_at,r.id
      FROM inbound_receipts r WHERE r.source_del_flag=0 AND r.source_id IS NULL AND r.posting_state='pending' AND r.created_at<=?
      UNION ALL
      SELECT 'outbound',o.order_no,o.created_at,o.id
      FROM outbound_orders o WHERE o.source_del_flag=0 AND o.source_id IS NULL
        AND o.status IN ('open','frozen','partially_shipped') AND o.created_at<=?
    ), oldest AS (
      SELECT kind,number,created_at FROM pending ORDER BY created_at,id LIMIT 1
    ), outbound_final AS (
      SELECT order_id,MAX(shipped_at) AS final_shipped_at FROM outbound_shipments GROUP BY order_id
    ), excluded AS (
      SELECT CONCAT('inbound_',r.posting_state) AS reason,c.created_at AS excluded_at,r.created_at
      FROM inbound_receipts r LEFT JOIN document_closures c ON c.inbound_receipt_id=r.id
      WHERE r.source_del_flag=0 AND r.source_id IS NULL AND r.posting_state IN ('reversed','voided')
      UNION ALL
      SELECT CONCAT('outbound_',o.status),
        CASE WHEN o.status='short_closed' THEN o.short_closed_at ELSE c.created_at END,o.created_at
      FROM outbound_orders o LEFT JOIN document_closures c ON c.outbound_order_id=o.id
      LEFT JOIN outbound_final f ON f.order_id=o.id
      WHERE o.source_del_flag=0 AND o.source_id IS NULL
        AND (o.status IN ('cancelled','voided') OR (o.status='short_closed' AND f.order_id IS NULL))
    ), excluded_stats AS (
      SELECT
        COUNT(CASE WHEN reason='inbound_reversed' AND excluded_at>=start_at AND excluded_at<end_at
          AND excluded_at>=created_at AND excluded_at<=as_of THEN 1 END) AS inboundReversed,
        COUNT(CASE WHEN reason='inbound_voided' AND excluded_at>=start_at AND excluded_at<end_at
          AND excluded_at>=created_at AND excluded_at<=as_of THEN 1 END) AS inboundVoided,
        COUNT(CASE WHEN reason='outbound_cancelled' AND excluded_at>=start_at AND excluded_at<end_at
          AND excluded_at>=created_at AND excluded_at<=as_of THEN 1 END) AS outboundReversed,
        COUNT(CASE WHEN reason='outbound_voided' AND excluded_at>=start_at AND excluded_at<end_at
          AND excluded_at>=created_at AND excluded_at<=as_of THEN 1 END) AS outboundVoided,
        COUNT(CASE WHEN reason='outbound_short_closed' AND excluded_at>=start_at AND excluded_at<end_at
          AND excluded_at>=created_at AND excluded_at<=as_of THEN 1 END) AS outboundUnshipped,
        COUNT(CASE WHEN reason='inbound_reversed' AND (excluded_at IS NULL OR excluded_at<created_at) THEN 1 END) AS inboundReversedUndated,
        COUNT(CASE WHEN reason='inbound_voided' AND (excluded_at IS NULL OR excluded_at<created_at) THEN 1 END) AS inboundVoidedUndated,
        COUNT(CASE WHEN reason='outbound_cancelled' AND (excluded_at IS NULL OR excluded_at<created_at) THEN 1 END) AS outboundReversedUndated,
        COUNT(CASE WHEN reason='outbound_voided' AND (excluded_at IS NULL OR excluded_at<created_at) THEN 1 END) AS outboundVoidedUndated,
        COUNT(CASE WHEN reason='outbound_short_closed' AND (excluded_at IS NULL OR excluded_at<created_at) THEN 1 END) AS outboundUnshippedUndated
      FROM excluded CROSS JOIN duration_period WHERE created_at<end_at AND created_at<=as_of
    ), inbound_stats AS (
      SELECT COUNT(*) AS completed,
        AVG(TIMESTAMPDIFF(MICROSECOND,r.created_at,op.created_at)/3600000000) AS average_hours
      FROM inbound_receipts r JOIN inventory_operations op ON op.id=r.confirmation_operation_id
        AND op.operation_type='inbound.confirm' AND op.target_id=r.id
      WHERE r.source_del_flag=0 AND r.source_id IS NULL AND r.posting_state='confirmed'
        AND op.created_at>=r.created_at AND op.created_at>=? AND op.created_at<? AND op.created_at<=?
    ), outbound_stats AS (
      SELECT COUNT(*) AS completed,
        AVG(TIMESTAMPDIFF(MICROSECOND,o.created_at,f.final_shipped_at)/3600000000) AS average_hours
      FROM outbound_orders o JOIN outbound_final f ON f.order_id=o.id
      WHERE o.source_del_flag=0 AND o.source_id IS NULL AND o.status IN ('confirmed','short_closed')
        AND f.final_shipped_at>=o.created_at AND f.final_shipped_at>=? AND f.final_shipped_at<? AND f.final_shipped_at<=?
    )
    SELECT e.*,i.completed AS inboundCompleted,i.average_hours AS inboundAverageHours,
      o.completed AS outboundCompleted,o.average_hours AS outboundAverageHours,
      (SELECT COUNT(*) FROM inbound_receipts r LEFT JOIN inventory_operations op ON op.id=r.confirmation_operation_id
        AND op.operation_type='inbound.confirm' AND op.target_id=r.id
        WHERE r.source_del_flag=0 AND r.source_id IS NULL AND r.posting_state='confirmed'
          AND r.created_at<? AND r.created_at<=?
          AND (op.id IS NULL OR op.created_at<r.created_at)) AS inboundMissing,
      (SELECT COUNT(*) FROM outbound_orders b LEFT JOIN outbound_final f ON f.order_id=b.id
        WHERE b.source_del_flag=0 AND b.source_id IS NULL AND b.status IN ('confirmed','short_closed')
          AND b.created_at<? AND b.created_at<=?
          AND ((b.status='confirmed' AND f.order_id IS NULL) OR f.final_shipped_at<b.created_at)) AS outboundMissing,
      oldest.kind AS pendingKind,oldest.number AS pendingNumber,oldest.created_at AS pendingCreatedAt
    FROM inbound_stats i CROSS JOIN outbound_stats o CROSS JOIN excluded_stats e LEFT JOIN oldest ON 1=1`;
