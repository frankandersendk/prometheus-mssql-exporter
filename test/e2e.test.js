const request = require("superagent");

function parse(text) {
  let lines = text.split("\n");
  lines = lines.filter((line) => !line.startsWith("#")).filter((line) => line.length !== 0);
  const o = {};
  lines.forEach((line) => {
    expect(line.indexOf(" ")).toBeGreaterThanOrEqual(0);
    [key, value] = line.split(" ");
    o[key] = parseInt(value);
  });
  return o;
}

describe("E2E Test", function () {
  it("Fetch all metrics and ensure that all expected are present", async function () {
    const data = await request.get("http://localhost:4000/metrics");
    expect(data.status).toBe(200);
    let text = data.text;
    const lines = parse(text);

    // some specific tests
    expect(lines.mssql_up).toBe(1);
    expect([14, 15]).toContain(lines.mssql_product_version);
    expect(lines.mssql_instance_local_time).toBeGreaterThan(0);
    expect(lines.mssql_total_physical_memory_kb).toBeGreaterThan(0);

    // lets ensure that there is at least one instance of these entries
    const multiLabelMetrics = [
      "mssql_client_connections",
      "mssql_database_filesize",
      "mssql_database_recovery_model",
      "mssql_database_compatibility_level",
      "mssql_database_auto_close",
      "mssql_database_auto_shrink",
      "mssql_database_page_verify",
      "mssql_tempdb_file_size_kb",
      "mssql_tempdb_space_used_kb",
      "mssql_log_space_used_percent",
      "mssql_log_space_used_mb",
      "mssql_log_space_total_mb",
      "mssql_log_reuse_wait",
      "mssql_log_vlf_count",
    ];
    multiLabelMetrics.forEach((metricPrefix) => {
      const keys = Object.keys(lines);
      const i = keys.findIndex((key) => key.startsWith(metricPrefix));
      expect(i).toBeGreaterThanOrEqual(0);
      keys
        .filter((key) => key.startsWith(metricPrefix))
        .forEach((key) => {
          delete lines[key];
        });
    });

    // Check for metrics that should exist as single values (no labels or will be empty in test environment)
    const expectedSingleMetrics = [
      "mssql_up",
      "mssql_product_version",
      "mssql_instance_local_time",
      "mssql_deadlocks",
      "mssql_user_errors",
      "mssql_kill_connection_errors",
      "mssql_page_read_total",
      "mssql_page_write_total",
      "mssql_page_life_expectancy",
      "mssql_lazy_write_total",
      "mssql_page_checkpoint_total",
      "mssql_batch_requests",
      "mssql_page_fault_count",
      "mssql_memory_utilization_percentage",
      "mssql_total_physical_memory_kb",
      "mssql_available_physical_memory_kb",
      "mssql_total_page_file_kb",
      "mssql_available_page_file_kb",
      "mssql_blocked_session_count",
      "mssql_tempdb_file_count",
      "mssql_tempdb_version_store_mb",
      "mssql_failed_login_count",
      "mssql_cpu_usage_percent",
      "mssql_scheduler_runnable_tasks_count",
      "mssql_context_switches_count",
    ];

    expectedSingleMetrics.forEach((metric) => {
      expect(lines[metric]).toBeDefined();
    });

    // Check for metrics with database labels that should exist
    const databaseLabelMetrics = [
      "mssql_connections",
      "mssql_database_state",
      "mssql_log_growths",
      "mssql_io_stall",
      "mssql_io_stall_total",
      "mssql_transactions",
    ];

    databaseLabelMetrics.forEach((metricPrefix) => {
      const keys = Object.keys(lines);
      const found = keys.filter((key) => key.startsWith(metricPrefix));
      expect(found.length).toBeGreaterThan(0);
    });

    // Check that wait stats metrics exist (at least some wait types should be present)
    const keys = Object.keys(lines);
    const waitTimeMetrics = keys.filter((key) => key.startsWith("mssql_wait_time_ms"));
    const waitCountMetrics = keys.filter((key) => key.startsWith("mssql_wait_count"));
    expect(waitTimeMetrics.length).toBeGreaterThan(0);
    expect(waitCountMetrics.length).toBeGreaterThan(0);
  });
});
