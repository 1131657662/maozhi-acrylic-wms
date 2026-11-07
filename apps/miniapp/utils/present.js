const labels = { open: '待扫码', frozen: '待出库确认', confirmed: '已出库' };
const colors = { open: '#909399', frozen: '#E6A23C', confirmed: '#67C23A' };
function present(order) {
  return {
    ...order,
    statusLabel: labels[order.status],
    statusColor: colors[order.status],
    plannedTonnes: (order.plannedWeightGrams / 1000000).toFixed(4),
    actualTonnes: (order.actualWeightGrams / 1000000).toFixed(4),
  };
}
module.exports = { present };
