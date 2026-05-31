const counters = {
  webhook_received_total: 0,
  webhook_rejected_total: 0,
  kafka_publish_failed_total: 0,
  dead_letter_total: 0
};

function inc(name, value = 1) {
  counters[name] = (counters[name] || 0) + value;
}

function renderPrometheus() {
  return Object.entries(counters)
    .map(([name, value]) => `# TYPE ${name} counter\n${name} ${value}`)
    .join("\n");
}

module.exports = {
  inc,
  renderPrometheus
};
