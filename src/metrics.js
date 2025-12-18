/**
 * Collection of metrics and their associated SQL requests
 * Created by Pierre Awaragi
 */
const metricsLog = require("debug")("metrics");
const client = require("prom-client");
const { productVersionParse } = require("./utils");

const mssql_up = {
  metrics: {
    mssql_up: new client.Gauge({ name: "mssql_up", help: "UP Status" }),
  },
  query: "SELECT 1",
  collect: (rows, metrics) => {
    let mssql_up = rows[0][0].value;
    metricsLog("Fetched status of instance", mssql_up);
    metrics.mssql_up.set(mssql_up);
  },
};

const mssql_product_version = {
  metrics: {
    mssql_product_version: new client.Gauge({ name: "mssql_product_version", help: "Instance version (Major.Minor)" }),
  },
  query: `SELECT CONVERT(VARCHAR(128), SERVERPROPERTY ('productversion')) AS ProductVersion,
  SERVERPROPERTY('ProductVersion') AS ProductVersion
`,
  collect: (rows, metrics) => {
    let v = productVersionParse(rows[0][0].value);
    const mssql_product_version = v.major + "." + v.minor;
    metricsLog("Fetched version of instance", mssql_product_version);
    metrics.mssql_product_version.set(mssql_product_version);
  },
};

const mssql_instance_local_time = {
  metrics: {
    mssql_instance_local_time: new client.Gauge({ name: "mssql_instance_local_time", help: "Number of seconds since epoch on local instance" }),
  },
  query: `SELECT DATEDIFF(second, '19700101', GETUTCDATE())`,
  collect: (rows, metrics) => {
    const mssql_instance_local_time = rows[0][0].value;
    metricsLog("Fetched current time", mssql_instance_local_time);
    metrics.mssql_instance_local_time.set(mssql_instance_local_time);
  },
};

const mssql_connections = {
  metrics: {
    mssql_connections: new client.Gauge({ name: "mssql_connections", help: "Number of active connections", labelNames: ["database", "state"] }),
  },
  query: `SELECT DB_NAME(sP.dbid)
        , COUNT(sP.spid)
FROM sys.sysprocesses sP
GROUP BY DB_NAME(sP.dbid)`,
  collect: (rows, metrics) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const database = row[0].value;
      const mssql_connections = row[1].value;
      metricsLog("Fetched number of connections for database", database, mssql_connections);
      metrics.mssql_connections.set({ database, state: "current" }, mssql_connections);
    }
  },
};

const mssql_client_connections = {
  metrics: {
    mssql_client_connections: new client.Gauge({
      name: "mssql_client_connections",
      help: "Number of active client connections",
      labelNames: ["client", "database"],
    }),
  },
  query: `SELECT host_name, DB_NAME(dbid) dbname, COUNT(*) session_count
FROM sys.dm_exec_sessions a
LEFT JOIN sysprocesses b on a.session_id=b.spid
WHERE is_user_process=1
GROUP BY host_name, dbid`,
  collect: (rows, metrics) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const client = row[0].value;
      const database = row[1].value;
      const mssql_client_connections = row[2].value;
      metricsLog("Fetched number of connections for client", client, database, mssql_client_connections);
      metrics.mssql_client_connections.set({ client, database }, mssql_client_connections);
    }
  },
};

const mssql_deadlocks = {
  metrics: {
    mssql_deadlocks_per_second: new client.Gauge({
      name: "mssql_deadlocks",
      help: "Number of lock requests per second that resulted in a deadlock since last restart",
    }),
  },
  query: `SELECT cntr_value
FROM sys.dm_os_performance_counters
WHERE counter_name = 'Number of Deadlocks/sec' AND instance_name = '_Total'`,
  collect: (rows, metrics) => {
    const mssql_deadlocks = rows[0][0].value;
    metricsLog("Fetched number of deadlocks/sec", mssql_deadlocks);
    metrics.mssql_deadlocks_per_second.set(mssql_deadlocks);
  },
};

const mssql_user_errors = {
  metrics: {
    mssql_user_errors: new client.Gauge({ name: "mssql_user_errors", help: "Number of user errors/sec since last restart" }),
  },
  query: `SELECT cntr_value
FROM sys.dm_os_performance_counters
WHERE counter_name = 'Errors/sec' AND instance_name = 'User Errors'`,
  collect: (rows, metrics) => {
    const mssql_user_errors = rows[0][0].value;
    metricsLog("Fetched number of user errors/sec", mssql_user_errors);
    metrics.mssql_user_errors.set(mssql_user_errors);
  },
};

const mssql_kill_connection_errors = {
  metrics: {
    mssql_kill_connection_errors: new client.Gauge({ name: "mssql_kill_connection_errors", help: "Number of kill connection errors/sec since last restart" }),
  },
  query: `SELECT cntr_value
FROM sys.dm_os_performance_counters
WHERE counter_name = 'Errors/sec' AND instance_name = 'Kill Connection Errors'`,
  collect: (rows, metrics) => {
    const mssql_kill_connection_errors = rows[0][0].value;
    metricsLog("Fetched number of kill connection errors/sec", mssql_kill_connection_errors);
    metrics.mssql_kill_connection_errors.set(mssql_kill_connection_errors);
  },
};

const mssql_database_state = {
  metrics: {
    mssql_database_state: new client.Gauge({
      name: "mssql_database_state",
      help: "Databases states: 0=ONLINE 1=RESTORING 2=RECOVERING 3=RECOVERY_PENDING 4=SUSPECT 5=EMERGENCY 6=OFFLINE 7=COPYING 10=OFFLINE_SECONDARY",
      labelNames: ["database"],
    }),
  },
  query: `SELECT name,state FROM master.sys.databases`,
  collect: (rows, metrics) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const database = row[0].value;
      const mssql_database_state = row[1].value;
      metricsLog("Fetched state for database", database, mssql_database_state);
      metrics.mssql_database_state.set({ database }, mssql_database_state);
    }
  },
};

const mssql_log_growths = {
  metrics: {
    mssql_log_growths: new client.Gauge({
      name: "mssql_log_growths",
      help: "Total number of times the transaction log for the database has been expanded last restart",
      labelNames: ["database"],
    }),
  },
  query: `SELECT rtrim(instance_name), cntr_value
FROM sys.dm_os_performance_counters 
WHERE counter_name = 'Log Growths' and instance_name <> '_Total'`,
  collect: (rows, metrics) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const database = row[0].value;
      const mssql_log_growths = row[1].value;
      metricsLog("Fetched number log growths for database", database, mssql_log_growths);
      metrics.mssql_log_growths.set({ database }, mssql_log_growths);
    }
  },
};

const mssql_database_filesize = {
  metrics: {
    mssql_database_filesize: new client.Gauge({
      name: "mssql_database_filesize",
      help: "Physical sizes of files used by database in KB, their names and types (0=rows, 1=log, 2=filestream,3=n/a 4=fulltext(before v2008 of MSSQL))",
      labelNames: ["database", "logicalname", "type", "filename"],
    }),
  },
  query: `SELECT DB_NAME(database_id) AS database_name, name AS logical_name, type, physical_name, (size * CAST(8 AS BIGINT)) size_kb FROM sys.master_files`,
  collect: (rows, metrics) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const database = row[0].value;
      const logicalname = row[1].value;
      const type = row[2].value;
      const filename = row[3].value;
      const mssql_database_filesize = row[4].value;
      metricsLog(
        "Fetched size of files for database ",
        database,
        "logicalname",
        logicalname,
        "type",
        type,
        "filename",
        filename,
        "size",
        mssql_database_filesize
      );
      metrics.mssql_database_filesize.set({ database, logicalname, type, filename }, mssql_database_filesize);
    }
  },
};

const mssql_buffer_manager = {
  metrics: {
    mssql_page_read_total: new client.Gauge({ name: "mssql_page_read_total", help: "Page reads/sec" }),
    mssql_page_write_total: new client.Gauge({ name: "mssql_page_write_total", help: "Page writes/sec" }),
    mssql_page_life_expectancy: new client.Gauge({
      name: "mssql_page_life_expectancy",
      help: "Indicates the minimum number of seconds a page will stay in the buffer pool on this node without references. The traditional advice from Microsoft used to be that the PLE should remain above 300 seconds",
    }),
    mssql_lazy_write_total: new client.Gauge({ name: "mssql_lazy_write_total", help: "Lazy writes/sec" }),
    mssql_page_checkpoint_total: new client.Gauge({ name: "mssql_page_checkpoint_total", help: "Checkpoint pages/sec" }),
  },
  query: `SELECT * FROM 
        (
            SELECT rtrim(counter_name) as counter_name, cntr_value
            FROM sys.dm_os_performance_counters
            WHERE counter_name in ('Page reads/sec', 'Page writes/sec', 'Page life expectancy', 'Lazy writes/sec', 'Checkpoint pages/sec')
            AND object_name = 'SQLServer:Buffer Manager'
        ) d
        PIVOT
        (
        MAX(cntr_value)
        FOR counter_name IN ([Page reads/sec], [Page writes/sec], [Page life expectancy], [Lazy writes/sec], [Checkpoint pages/sec])
        ) piv
    `,
  collect: (rows, metrics) => {
    const row = rows[0];
    const page_read = row[0].value;
    const page_write = row[1].value;
    const page_life_expectancy = row[2].value;
    const lazy_write_total = row[3].value;
    const page_checkpoint_total = row[4].value;
    metricsLog(
      "Fetched the Buffer Manager",
      "page_read",
      page_read,
      "page_write",
      page_write,
      "page_life_expectancy",
      page_life_expectancy,
      "page_checkpoint_total",
      "page_checkpoint_total",
      page_checkpoint_total,
      "lazy_write_total",
      lazy_write_total
    );
    metrics.mssql_page_read_total.set(page_read);
    metrics.mssql_page_write_total.set(page_write);
    metrics.mssql_page_life_expectancy.set(page_life_expectancy);
    metrics.mssql_page_checkpoint_total.set(page_checkpoint_total);
    metrics.mssql_lazy_write_total.set(lazy_write_total);
  },
};

const mssql_io_stall = {
  metrics: {
    mssql_io_stall: new client.Gauge({ name: "mssql_io_stall", help: "Wait time (ms) of stall since last restart", labelNames: ["database", "type"] }),
    mssql_io_stall_total: new client.Gauge({ name: "mssql_io_stall_total", help: "Wait time (ms) of stall since last restart", labelNames: ["database"] }),
  },
  query: `SELECT
cast(DB_Name(a.database_id) as varchar) as name,
    max(io_stall_read_ms),
    max(io_stall_write_ms),
    max(io_stall),
    max(io_stall_queued_read_ms),
    max(io_stall_queued_write_ms)
FROM
sys.dm_io_virtual_file_stats(null, null) a
INNER JOIN sys.master_files b ON a.database_id = b.database_id and a.file_id = b.file_id
GROUP BY a.database_id`,
  collect: (rows, metrics) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const database = row[0].value;
      const read = row[1].value;
      const write = row[2].value;
      const stall = row[3].value;
      const queued_read = row[4].value;
      const queued_write = row[5].value;
      metricsLog("Fetched number of stalls for database", database, "read", read, "write", write, "queued_read", queued_read, "queued_write", queued_write);
      metrics.mssql_io_stall_total.set({ database }, stall);
      metrics.mssql_io_stall.set({ database, type: "read" }, read);
      metrics.mssql_io_stall.set({ database, type: "write" }, write);
      metrics.mssql_io_stall.set({ database, type: "queued_read" }, queued_read);
      metrics.mssql_io_stall.set({ database, type: "queued_write" }, queued_write);
    }
  },
};

const mssql_batch_requests = {
  metrics: {
    mssql_batch_requests: new client.Gauge({
      name: "mssql_batch_requests",
      help: "Number of Transact-SQL command batches received per second. This statistic is affected by all constraints (such as I/O, number of users, cachesize, complexity of requests, and so on). High batch requests mean good throughput",
    }),
  },
  query: `SELECT TOP 1 cntr_value
FROM sys.dm_os_performance_counters 
WHERE counter_name = 'Batch Requests/sec'`,
  collect: (rows, metrics) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const mssql_batch_requests = row[0].value;
      metricsLog("Fetched number of batch requests per second", mssql_batch_requests);
      metrics.mssql_batch_requests.set(mssql_batch_requests);
    }
  },
};

const mssql_transactions = {
  metrics: {
    mssql_transactions: new client.Gauge({
      name: "mssql_transactions",
      help: "Number of transactions started for the database per second. Transactions/sec does not count XTP-only transactions (transactions started by a natively compiled stored procedure.)",
      labelNames: ["database"],
    }),
  },
  query: `SELECT rtrim(instance_name), cntr_value
FROM sys.dm_os_performance_counters
WHERE counter_name = 'Transactions/sec' AND instance_name <> '_Total'`,
  collect: (rows, metrics) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const database = row[0].value;
      const transactions = row[1].value;
      metricsLog("Fetched number of transactions per second", database, transactions);
      metrics.mssql_transactions.set({ database }, transactions);
    }
  },
};

const mssql_os_process_memory = {
  metrics: {
    mssql_page_fault_count: new client.Gauge({ name: "mssql_page_fault_count", help: "Number of page faults since last restart" }),
    mssql_memory_utilization_percentage: new client.Gauge({ name: "mssql_memory_utilization_percentage", help: "Percentage of memory utilization" }),
  },
  query: `SELECT page_fault_count, memory_utilization_percentage 
FROM sys.dm_os_process_memory`,
  collect: (rows, metrics) => {
    const page_fault_count = rows[0][0].value;
    const memory_utilization_percentage = rows[0][1].value;
    metricsLog("Fetched page fault count", page_fault_count);
    metrics.mssql_page_fault_count.set(page_fault_count);
    metrics.mssql_memory_utilization_percentage.set(memory_utilization_percentage);
  },
};

const mssql_os_sys_memory = {
  metrics: {
    mssql_total_physical_memory_kb: new client.Gauge({ name: "mssql_total_physical_memory_kb", help: "Total physical memory in KB" }),
    mssql_available_physical_memory_kb: new client.Gauge({ name: "mssql_available_physical_memory_kb", help: "Available physical memory in KB" }),
    mssql_total_page_file_kb: new client.Gauge({ name: "mssql_total_page_file_kb", help: "Total page file in KB" }),
    mssql_available_page_file_kb: new client.Gauge({ name: "mssql_available_page_file_kb", help: "Available page file in KB" }),
  },
  query: `SELECT total_physical_memory_kb, available_physical_memory_kb, total_page_file_kb, available_page_file_kb
FROM sys.dm_os_sys_memory`,
  collect: (rows, metrics) => {
    const mssql_total_physical_memory_kb = rows[0][0].value;
    const mssql_available_physical_memory_kb = rows[0][1].value;
    const mssql_total_page_file_kb = rows[0][2].value;
    const mssql_available_page_file_kb = rows[0][3].value;
    metricsLog(
      "Fetched system memory information",
      "Total physical memory",
      mssql_total_physical_memory_kb,
      "Available physical memory",
      mssql_available_physical_memory_kb,
      "Total page file",
      mssql_total_page_file_kb,
      "Available page file",
      mssql_available_page_file_kb
    );
    metrics.mssql_total_physical_memory_kb.set(mssql_total_physical_memory_kb);
    metrics.mssql_available_physical_memory_kb.set(mssql_available_physical_memory_kb);
    metrics.mssql_total_page_file_kb.set(mssql_total_page_file_kb);
    metrics.mssql_available_page_file_kb.set(mssql_available_page_file_kb);
  },
};

const mssql_sql_agent_jobs = {
  metrics: {
    mssql_sql_agent_job_status: new client.Gauge({
      name: "mssql_sql_agent_job_status",
      help: "SQL Agent job last run status (-1=Never Run, 0=Failed, 1=Succeeded, 2=Retry, 3=Canceled, 4=In Progress)",
      labelNames: ["job_name", "job_id"],
    }),
    mssql_sql_agent_job_enabled: new client.Gauge({
      name: "mssql_sql_agent_job_enabled",
      help: "SQL Agent job enabled status (0=Disabled, 1=Enabled)",
      labelNames: ["job_name", "job_id"],
    }),
    mssql_sql_agent_job_last_run_seconds: new client.Gauge({
      name: "mssql_sql_agent_job_last_run_seconds",
      help: "SQL Agent job last run time in seconds since epoch",
      labelNames: ["job_name", "job_id"],
    }),
    mssql_sql_agent_job_next_run_seconds: new client.Gauge({
      name: "mssql_sql_agent_job_next_run_seconds",
      help: "SQL Agent job next scheduled run time in seconds since epoch",
      labelNames: ["job_name", "job_id"],
    }),
    mssql_sql_agent_job_last_duration_seconds: new client.Gauge({
      name: "mssql_sql_agent_job_last_duration_seconds",
      help: "SQL Agent job last run duration in seconds",
      labelNames: ["job_name", "job_id"],
    }),
  },
  query: `SELECT
    j.name AS job_name,
    CAST(j.job_id AS VARCHAR(50)) AS job_id,
    j.enabled,
    CASE
        WHEN h.run_status IS NULL THEN -1
        ELSE h.run_status
    END AS last_run_status,
    CASE
        WHEN h.run_date IS NULL THEN 0
        ELSE DATEDIFF(SECOND, '19700101',
            CAST(
                CAST(h.run_date AS CHAR(8)) + ' ' +
                STUFF(STUFF(RIGHT('000000' + CAST(h.run_time AS VARCHAR(6)), 6), 5, 0, ':'), 3, 0, ':')
                AS DATETIME
            ))
    END AS last_run_seconds,
    CASE
        WHEN ja.next_scheduled_run_date IS NULL OR ja.next_scheduled_run_date = 0 THEN 0
        ELSE DATEDIFF(SECOND, '19700101',
            CAST(
                CAST(ja.next_scheduled_run_date AS CHAR(8)) + ' ' +
                STUFF(STUFF(RIGHT('000000' + CAST(ja.next_scheduled_run_time AS VARCHAR(6)), 6), 5, 0, ':'), 3, 0, ':')
                AS DATETIME
            ))
    END AS next_run_seconds,
    CASE
        WHEN h.run_duration IS NULL THEN 0
        ELSE (h.run_duration / 10000 * 3600) + ((h.run_duration % 10000) / 100 * 60) + (h.run_duration % 100)
    END AS last_duration_seconds
FROM msdb.dbo.sysjobs j
LEFT JOIN (
    SELECT job_id, run_status, run_date, run_time, run_duration,
           ROW_NUMBER() OVER (PARTITION BY job_id ORDER BY run_date DESC, run_time DESC) AS rn
    FROM msdb.dbo.sysjobhistory
    WHERE step_id = 0
) h ON j.job_id = h.job_id AND h.rn = 1
LEFT JOIN (
    SELECT job_id,
           MIN(next_run_date) AS next_scheduled_run_date,
           MIN(next_run_time) AS next_scheduled_run_time
    FROM msdb.dbo.sysjobschedules js
    INNER JOIN msdb.dbo.sysschedules s ON js.schedule_id = s.schedule_id
    WHERE next_run_date > 0
    GROUP BY job_id
) ja ON j.job_id = ja.job_id`,
  collect: (rows, metrics) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const job_name = row[0].value;
      const job_id = row[1].value;
      const enabled = row[2].value ? 1 : 0;
      const last_run_status = row[3].value;
      const last_run_seconds = row[4].value;
      const next_run_seconds = row[5].value;
      const last_duration_seconds = row[6].value;

      metricsLog("Fetched SQL Agent job", job_name, "enabled", enabled, "status", last_run_status, "duration", last_duration_seconds);

      // Always set all metrics, even for jobs that have never run (status=-1, seconds=0)
      // This ensures they appear in Grafana tables
      metrics.mssql_sql_agent_job_status.set({ job_name, job_id }, last_run_status);
      metrics.mssql_sql_agent_job_enabled.set({ job_name, job_id }, enabled);
      metrics.mssql_sql_agent_job_last_run_seconds.set({ job_name, job_id }, last_run_seconds);
      metrics.mssql_sql_agent_job_next_run_seconds.set({ job_name, job_id }, next_run_seconds);
      metrics.mssql_sql_agent_job_last_duration_seconds.set({ job_name, job_id }, last_duration_seconds);
    }

    if (rows.length === 0) {
      metricsLog("No SQL Agent jobs found");
    }
  },
};

const mssql_database_backups = {
  metrics: {
    mssql_database_backup_last_full_seconds: new client.Gauge({
      name: "mssql_database_backup_last_full_seconds",
      help: "Last full backup time in seconds since epoch",
      labelNames: ["database"],
    }),
    mssql_database_backup_last_diff_seconds: new client.Gauge({
      name: "mssql_database_backup_last_diff_seconds",
      help: "Last differential backup time in seconds since epoch",
      labelNames: ["database"],
    }),
    mssql_database_backup_last_log_seconds: new client.Gauge({
      name: "mssql_database_backup_last_log_seconds",
      help: "Last transaction log backup time in seconds since epoch",
      labelNames: ["database"],
    }),
    mssql_database_backup_age_full_hours: new client.Gauge({
      name: "mssql_database_backup_age_full_hours",
      help: "Hours since last full backup",
      labelNames: ["database"],
    }),
    mssql_database_backup_age_diff_hours: new client.Gauge({
      name: "mssql_database_backup_age_diff_hours",
      help: "Hours since last differential backup",
      labelNames: ["database"],
    }),
    mssql_database_backup_age_log_hours: new client.Gauge({
      name: "mssql_database_backup_age_log_hours",
      help: "Hours since last transaction log backup",
      labelNames: ["database"],
    }),
    mssql_database_backup_size_mb: new client.Gauge({
      name: "mssql_database_backup_size_mb",
      help: "Last backup size in MB",
      labelNames: ["database", "type"],
    }),
  },
  query: `SELECT
    d.name AS database_name,
    ISNULL(DATEDIFF(SECOND, '19700101', MAX(CASE WHEN b.type = 'D' THEN b.backup_finish_date END)), 0) AS last_full_backup_seconds,
    ISNULL(DATEDIFF(SECOND, '19700101', MAX(CASE WHEN b.type = 'I' THEN b.backup_finish_date END)), 0) AS last_diff_backup_seconds,
    ISNULL(DATEDIFF(SECOND, '19700101', MAX(CASE WHEN b.type = 'L' THEN b.backup_finish_date END)), 0) AS last_log_backup_seconds,
    ISNULL(DATEDIFF(HOUR, MAX(CASE WHEN b.type = 'D' THEN b.backup_finish_date END), GETDATE()), -1) AS age_full_hours,
    ISNULL(DATEDIFF(HOUR, MAX(CASE WHEN b.type = 'I' THEN b.backup_finish_date END), GETDATE()), -1) AS age_diff_hours,
    ISNULL(DATEDIFF(HOUR, MAX(CASE WHEN b.type = 'L' THEN b.backup_finish_date END), GETDATE()), -1) AS age_log_hours,
    ISNULL(MAX(CASE WHEN b.type = 'D' THEN b.backup_size END) / 1024.0 / 1024.0, 0) AS last_full_size_mb,
    ISNULL(MAX(CASE WHEN b.type = 'I' THEN b.backup_size END) / 1024.0 / 1024.0, 0) AS last_diff_size_mb,
    ISNULL(MAX(CASE WHEN b.type = 'L' THEN b.backup_size END) / 1024.0 / 1024.0, 0) AS last_log_size_mb
FROM sys.databases d
LEFT JOIN msdb.dbo.backupset b ON d.name = b.database_name
WHERE d.database_id > 4
GROUP BY d.name`,
  collect: (rows, metrics) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const database = row[0].value;
      const last_full_seconds = row[1].value;
      const last_diff_seconds = row[2].value;
      const last_log_seconds = row[3].value;
      const age_full_hours = row[4].value;
      const age_diff_hours = row[5].value;
      const age_log_hours = row[6].value;
      const last_full_size_mb = row[7].value;
      const last_diff_size_mb = row[8].value;
      const last_log_size_mb = row[9].value;

      metricsLog(
        "Fetched backup info for database",
        database,
        "full backup age (hours)",
        age_full_hours,
        "diff backup age (hours)",
        age_diff_hours,
        "log backup age (hours)",
        age_log_hours
      );

      metrics.mssql_database_backup_last_full_seconds.set({ database }, last_full_seconds);
      metrics.mssql_database_backup_last_diff_seconds.set({ database }, last_diff_seconds);
      metrics.mssql_database_backup_last_log_seconds.set({ database }, last_log_seconds);
      metrics.mssql_database_backup_age_full_hours.set({ database }, age_full_hours);
      metrics.mssql_database_backup_age_diff_hours.set({ database }, age_diff_hours);
      metrics.mssql_database_backup_age_log_hours.set({ database }, age_log_hours);
      metrics.mssql_database_backup_size_mb.set({ database, type: "full" }, last_full_size_mb);
      metrics.mssql_database_backup_size_mb.set({ database, type: "diff" }, last_diff_size_mb);
      metrics.mssql_database_backup_size_mb.set({ database, type: "log" }, last_log_size_mb);
    }
  },
};

const mssql_availability_groups = {
  metrics: {
    mssql_ag_replica_role: new client.Gauge({
      name: "mssql_ag_replica_role",
      help: "Availability group replica role (0=Resolving, 1=Primary, 2=Secondary)",
      labelNames: ["ag_name", "replica_server"],
    }),
    mssql_ag_replica_sync_state: new client.Gauge({
      name: "mssql_ag_replica_sync_state",
      help: "Availability group replica synchronization state (0=NotSynchronizing, 1=Synchronizing, 2=Synchronized, 3=Reverting, 4=Initializing)",
      labelNames: ["ag_name", "replica_server", "database"],
    }),
    mssql_ag_replica_sync_health: new client.Gauge({
      name: "mssql_ag_replica_sync_health",
      help: "Availability group replica synchronization health (0=NotHealthy, 1=PartiallyHealthy, 2=Healthy)",
      labelNames: ["ag_name", "replica_server"],
    }),
    mssql_ag_log_send_queue_size_kb: new client.Gauge({
      name: "mssql_ag_log_send_queue_size_kb",
      help: "Availability group log send queue size in KB",
      labelNames: ["ag_name", "replica_server", "database"],
    }),
    mssql_ag_redo_queue_size_kb: new client.Gauge({
      name: "mssql_ag_redo_queue_size_kb",
      help: "Availability group redo queue size in KB",
      labelNames: ["ag_name", "replica_server", "database"],
    }),
  },
  query: `IF EXISTS (SELECT 1 FROM sys.dm_hadr_availability_replica_states)
BEGIN
    SELECT
        ag.name AS ag_name,
        ar.replica_server_name,
        rs.role,
        rs.synchronization_health,
        ISNULL(DB_NAME(drs.database_id), 'N/A') AS database_name,
        ISNULL(drs.synchronization_state, 0) AS sync_state,
        ISNULL(drs.log_send_queue_size, 0) AS log_send_queue_size,
        ISNULL(drs.redo_queue_size, 0) AS redo_queue_size
    FROM sys.dm_hadr_availability_replica_states rs
    INNER JOIN sys.availability_replicas ar ON rs.replica_id = ar.replica_id
    INNER JOIN sys.availability_groups ag ON ar.group_id = ag.group_id
    LEFT JOIN sys.dm_hadr_database_replica_states drs ON rs.replica_id = drs.replica_id
END
ELSE
BEGIN
    SELECT NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL WHERE 1=0
END`,
  collect: (rows, metrics) => {
    if (rows.length === 0) {
      metricsLog("No availability groups found or feature not available");
      return;
    }
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const ag_name = row[0].value;
      const replica_server = row[1].value;
      const role = row[2].value;
      const sync_health = row[3].value;
      const database = row[4].value;
      const sync_state = row[5].value;
      const log_send_queue_size = row[6].value;
      const redo_queue_size = row[7].value;

      metricsLog("Fetched AG info", ag_name, "replica", replica_server, "database", database, "role", role, "sync_state", sync_state);

      metrics.mssql_ag_replica_role.set({ ag_name, replica_server }, role);
      metrics.mssql_ag_replica_sync_health.set({ ag_name, replica_server }, sync_health);

      if (database !== "N/A") {
        metrics.mssql_ag_replica_sync_state.set({ ag_name, replica_server, database }, sync_state);
        metrics.mssql_ag_log_send_queue_size_kb.set({ ag_name, replica_server, database }, log_send_queue_size);
        metrics.mssql_ag_redo_queue_size_kb.set({ ag_name, replica_server, database }, redo_queue_size);
      }
    }
  },
};

const mssql_blocking_sessions = {
  metrics: {
    mssql_blocked_session_count: new client.Gauge({
      name: "mssql_blocked_session_count",
      help: "Number of currently blocked sessions",
    }),
    mssql_blocking_session_wait_time_ms: new client.Gauge({
      name: "mssql_blocking_session_wait_time_ms",
      help: "Wait time in milliseconds for blocked sessions",
      labelNames: ["database", "wait_type"],
    }),
  },
  query: `SELECT
    COUNT(*) AS blocked_count,
    ISNULL(DB_NAME(er.database_id), 'N/A') AS database_name,
    er.wait_type,
    SUM(er.wait_time) AS total_wait_time_ms
FROM sys.dm_exec_requests er
WHERE er.blocking_session_id <> 0
GROUP BY DB_NAME(er.database_id), er.wait_type`,
  collect: (rows, metrics) => {
    let total_blocked = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const blocked_count = row[0].value;
      const database = row[1].value;
      const wait_type = row[2].value;
      const wait_time_ms = row[3].value;

      total_blocked += blocked_count;
      metricsLog("Fetched blocking info", "database", database, "wait_type", wait_type, "count", blocked_count, "wait_time", wait_time_ms);
      metrics.mssql_blocking_session_wait_time_ms.set({ database, wait_type }, wait_time_ms);
    }
    metrics.mssql_blocked_session_count.set(total_blocked);
    metricsLog("Total blocked sessions", total_blocked);
  },
};

const mssql_wait_stats = {
  metrics: {
    mssql_wait_time_ms: new client.Gauge({
      name: "mssql_wait_time_ms",
      help: "Wait time in milliseconds by wait type since last restart",
      labelNames: ["wait_type", "category"],
    }),
    mssql_wait_count: new client.Gauge({
      name: "mssql_wait_count",
      help: "Number of waits by wait type since last restart",
      labelNames: ["wait_type", "category"],
    }),
  },
  query: `SELECT TOP 20
    wait_type,
    wait_time_ms,
    waiting_tasks_count,
    CASE
        WHEN wait_type LIKE 'LCK%' THEN 'Lock'
        WHEN wait_type LIKE 'PAGEIO%' OR wait_type LIKE 'WRITELOG' OR wait_type LIKE 'IO_%' THEN 'IO'
        WHEN wait_type LIKE 'RESOURCE_SEMAPHORE%' THEN 'Memory'
        WHEN wait_type LIKE 'SOS_SCHEDULER_YIELD' OR wait_type LIKE 'THREADPOOL' OR wait_type LIKE 'CX%' THEN 'CPU'
        WHEN wait_type LIKE 'ASYNC_NETWORK_IO' THEN 'Network'
        ELSE 'Other'
    END AS wait_category
FROM sys.dm_os_wait_stats
WHERE wait_type NOT IN (
    'CLR_SEMAPHORE', 'LAZYWRITER_SLEEP', 'RESOURCE_QUEUE', 'SLEEP_TASK',
    'SLEEP_SYSTEMTASK', 'SQLTRACE_BUFFER_FLUSH', 'WAITFOR', 'LOGMGR_QUEUE',
    'CHECKPOINT_QUEUE', 'REQUEST_FOR_DEADLOCK_SEARCH', 'XE_TIMER_EVENT', 'BROKER_TO_FLUSH',
    'BROKER_TASK_STOP', 'CLR_MANUAL_EVENT', 'CLR_AUTO_EVENT', 'DISPATCHER_QUEUE_SEMAPHORE',
    'FT_IFTS_SCHEDULER_IDLE_WAIT', 'XE_DISPATCHER_WAIT', 'XE_DISPATCHER_JOIN', 'SQLTRACE_INCREMENTAL_FLUSH_SLEEP',
    'ONDEMAND_TASK_QUEUE', 'BROKER_EVENTHANDLER', 'SLEEP_BPOOL_FLUSH', 'DIRTY_PAGE_POLL', 'HADR_FILESTREAM_IOMGR_IOCOMPLETION'
)
ORDER BY wait_time_ms DESC`,
  collect: (rows, metrics) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const wait_type = row[0].value;
      const wait_time_ms = row[1].value;
      const wait_count = row[2].value;
      const category = row[3].value;

      metricsLog("Fetched wait stat", "wait_type", wait_type, "category", category, "wait_time_ms", wait_time_ms, "count", wait_count);
      metrics.mssql_wait_time_ms.set({ wait_type, category }, wait_time_ms);
      metrics.mssql_wait_count.set({ wait_type, category }, wait_count);
    }
  },
};

const mssql_database_properties = {
  metrics: {
    mssql_database_recovery_model: new client.Gauge({
      name: "mssql_database_recovery_model",
      help: "Database recovery model (1=FULL, 2=BULK_LOGGED, 3=SIMPLE)",
      labelNames: ["database"],
    }),
    mssql_database_compatibility_level: new client.Gauge({
      name: "mssql_database_compatibility_level",
      help: "Database compatibility level",
      labelNames: ["database"],
    }),
    mssql_database_auto_close: new client.Gauge({
      name: "mssql_database_auto_close",
      help: "Database auto close setting (0=OFF, 1=ON)",
      labelNames: ["database"],
    }),
    mssql_database_auto_shrink: new client.Gauge({
      name: "mssql_database_auto_shrink",
      help: "Database auto shrink setting (0=OFF, 1=ON)",
      labelNames: ["database"],
    }),
    mssql_database_page_verify: new client.Gauge({
      name: "mssql_database_page_verify",
      help: "Database page verify option (0=NONE, 1=TORN_PAGE_DETECTION, 2=CHECKSUM)",
      labelNames: ["database"],
    }),
  },
  query: `SELECT
    name,
    recovery_model,
    compatibility_level,
    is_auto_close_on,
    is_auto_shrink_on,
    page_verify_option
FROM sys.databases
WHERE database_id > 4`,
  collect: (rows, metrics) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const database = row[0].value;
      const recovery_model = row[1].value;
      const compatibility_level = row[2].value;
      const auto_close = row[3].value ? 1 : 0;
      const auto_shrink = row[4].value ? 1 : 0;
      const page_verify = row[5].value;

      metricsLog(
        "Fetched database properties",
        database,
        "recovery_model",
        recovery_model,
        "compat_level",
        compatibility_level,
        "auto_close",
        auto_close,
        "auto_shrink",
        auto_shrink
      );

      metrics.mssql_database_recovery_model.set({ database }, recovery_model);
      metrics.mssql_database_compatibility_level.set({ database }, compatibility_level);
      metrics.mssql_database_auto_close.set({ database }, auto_close);
      metrics.mssql_database_auto_shrink.set({ database }, auto_shrink);
      metrics.mssql_database_page_verify.set({ database }, page_verify);
    }
  },
};

const mssql_tempdb_stats = {
  metrics: {
    mssql_tempdb_file_count: new client.Gauge({
      name: "mssql_tempdb_file_count",
      help: "Number of TempDB data files",
    }),
    mssql_tempdb_file_size_kb: new client.Gauge({
      name: "mssql_tempdb_file_size_kb",
      help: "TempDB file size in KB",
      labelNames: ["file_name", "file_type"],
    }),
    mssql_tempdb_space_used_kb: new client.Gauge({
      name: "mssql_tempdb_space_used_kb",
      help: "TempDB space used in KB",
      labelNames: ["file_name"],
    }),
    mssql_tempdb_version_store_mb: new client.Gauge({
      name: "mssql_tempdb_version_store_mb",
      help: "TempDB version store size in MB",
    }),
  },
  query: `SELECT
    (SELECT COUNT(*) FROM tempdb.sys.database_files WHERE type = 0) AS data_file_count,
    name AS file_name,
    type_desc AS file_type,
    (size * CAST(8 AS BIGINT)) AS size_kb,
    (FILEPROPERTY(name, 'SpaceUsed') * CAST(8 AS BIGINT)) AS space_used_kb
FROM tempdb.sys.database_files
UNION ALL
SELECT
    0,
    'VersionStore',
    'VersionStore',
    0,
    (SELECT SUM(version_store_reserved_page_count) * 8 FROM sys.dm_db_file_space_usage WHERE database_id = 2)`,
  collect: (rows, metrics) => {
    let file_count = 0;
    let version_store_kb = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const data_file_count = row[0].value;
      const file_name = row[1].value;
      const file_type = row[2].value;
      const size_kb = row[3].value;
      const space_used_kb = row[4].value;

      if (file_name === "VersionStore") {
        version_store_kb = space_used_kb || 0;
        metricsLog("Fetched TempDB version store size (KB)", version_store_kb);
      } else {
        // Only update file_count from actual file rows (not VersionStore row which has 0)
        if (data_file_count > 0) {
          file_count = data_file_count;
        }
        const used = space_used_kb || 0;
        metricsLog("Fetched TempDB file", file_name, "type", file_type, "size_kb", size_kb, "used_kb", used);
        metrics.mssql_tempdb_file_size_kb.set({ file_name, file_type }, size_kb);
        metrics.mssql_tempdb_space_used_kb.set({ file_name }, used);
      }
    }
    metrics.mssql_tempdb_file_count.set(file_count);
    metrics.mssql_tempdb_version_store_mb.set(version_store_kb / 1024.0);
  },
};

const mssql_transaction_log_stats = {
  metrics: {
    mssql_log_space_used_percent: new client.Gauge({
      name: "mssql_log_space_used_percent",
      help: "Transaction log space used percentage",
      labelNames: ["database"],
    }),
    mssql_log_space_used_mb: new client.Gauge({
      name: "mssql_log_space_used_mb",
      help: "Transaction log space used in MB",
      labelNames: ["database"],
    }),
    mssql_log_space_total_mb: new client.Gauge({
      name: "mssql_log_space_total_mb",
      help: "Transaction log total space in MB",
      labelNames: ["database"],
    }),
    mssql_log_reuse_wait: new client.Gauge({
      name: "mssql_log_reuse_wait",
      help: "Transaction log reuse wait reason (0=NOTHING, 1=CHECKPOINT, 2=LOG_BACKUP, 3=ACTIVE_BACKUP_OR_RESTORE, 4=ACTIVE_TRANSACTION, 5=DATABASE_MIRRORING, 6=REPLICATION, 7=DATABASE_SNAPSHOT_CREATION, 8=LOG_SCAN, 9=AVAILABILITY_REPLICA, 10=OLDEST_PAGE, 11=XTP_CHECKPOINT, 12=SLOG_SCAN, 13=OTHER_TRANSIENT)",
      labelNames: ["database"],
    }),
    mssql_log_vlf_count: new client.Gauge({
      name: "mssql_log_vlf_count",
      help: "Virtual log file count",
      labelNames: ["database"],
    }),
  },
  query: `CREATE TABLE #logspace (
    database_name NVARCHAR(128),
    log_size_mb DECIMAL(18,2),
    log_space_used_percent DECIMAL(5,2),
    status INT
);

INSERT INTO #logspace
EXEC('DBCC SQLPERF(LOGSPACE) WITH NO_INFOMSGS');

DECLARE @vlf_counts TABLE (database_id INT, vlf_count INT);
DECLARE @db_id INT;
DECLARE db_cursor CURSOR FOR
    SELECT database_id FROM sys.databases WHERE database_id > 4 AND state = 0;

OPEN db_cursor;
FETCH NEXT FROM db_cursor INTO @db_id;

WHILE @@FETCH_STATUS = 0
BEGIN
    BEGIN TRY
        INSERT INTO @vlf_counts (database_id, vlf_count)
        SELECT @db_id, COUNT(*) FROM sys.dm_db_log_info(@db_id);
    END TRY
    BEGIN CATCH
        INSERT INTO @vlf_counts (database_id, vlf_count) VALUES (@db_id, 0);
    END CATCH

    FETCH NEXT FROM db_cursor INTO @db_id;
END

CLOSE db_cursor;
DEALLOCATE db_cursor;

SELECT
    ls.database_name,
    CAST(ls.log_size_mb * (ls.log_space_used_percent / 100.0) AS DECIMAL(18,2)) AS log_space_used_mb,
    ls.log_size_mb AS log_space_total_mb,
    ls.log_space_used_percent,
    d.log_reuse_wait,
    ISNULL(v.vlf_count, 0) AS vlf_count
FROM #logspace ls
INNER JOIN sys.databases d ON ls.database_name = d.name
LEFT JOIN @vlf_counts v ON d.database_id = v.database_id
WHERE d.database_id > 4
  AND d.state = 0;

DROP TABLE #logspace;`,
  collect: (rows, metrics) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const database = row[0].value;
      const log_used_mb = row[1].value;
      const log_total_mb = row[2].value;
      const log_used_percent = row[3].value;
      const log_reuse_wait = row[4].value;
      const vlf_count = row[5].value;

      metricsLog(
        "Fetched transaction log stats",
        database,
        "used_mb",
        log_used_mb,
        "total_mb",
        log_total_mb,
        "used_percent",
        log_used_percent,
        "reuse_wait",
        log_reuse_wait,
        "vlf_count",
        vlf_count
      );

      metrics.mssql_log_space_used_mb.set({ database }, log_used_mb);
      metrics.mssql_log_space_total_mb.set({ database }, log_total_mb);
      metrics.mssql_log_space_used_percent.set({ database }, log_used_percent);
      metrics.mssql_log_reuse_wait.set({ database }, log_reuse_wait);
      metrics.mssql_log_vlf_count.set({ database }, vlf_count);
    }
  },
};

const mssql_security_stats = {
  metrics: {
    mssql_failed_login_count: new client.Gauge({
      name: "mssql_failed_login_count",
      help: "Number of failed login attempts in the error log (last 5 minutes)",
    }),
  },
  query: `CREATE TABLE #ErrorLog (
    LogDate DATETIME,
    ProcessInfo NVARCHAR(100),
    [Text] NVARCHAR(4000)
);

BEGIN TRY
    INSERT INTO #ErrorLog
    EXEC xp_readerrorlog 0, 1, N'Login failed';
END TRY
BEGIN CATCH
    -- If xp_readerrorlog fails due to permissions, return -1 to indicate unavailable
    SELECT -1 AS failed_login_count;
    RETURN;
END CATCH;

SELECT COUNT(*) AS failed_login_count
FROM #ErrorLog
WHERE LogDate >= DATEADD(MINUTE, -5, GETDATE());`,
  collect: (rows, metrics) => {
    const failed_count = rows.length > 0 ? rows[0][0].value : 0;
    metricsLog("Fetched failed login count", failed_count);
    metrics.mssql_failed_login_count.set(failed_count);
  },
};

const mssql_cpu_scheduler_stats = {
  metrics: {
    mssql_cpu_usage_percent: new client.Gauge({
      name: "mssql_cpu_usage_percent",
      help: "SQL Server CPU usage percentage",
    }),
    mssql_scheduler_runnable_tasks_count: new client.Gauge({
      name: "mssql_scheduler_runnable_tasks_count",
      help: "Number of runnable tasks waiting on schedulers",
    }),
    mssql_context_switches_count: new client.Gauge({
      name: "mssql_context_switches_count",
      help: "Number of context switches since last restart",
    }),
  },
  query: `SELECT TOP 1
    record.value('(./Record/SchedulerMonitorEvent/SystemHealth/ProcessUtilization)[1]', 'int') AS sql_cpu_usage,
    (SELECT SUM(runnable_tasks_count) FROM sys.dm_os_schedulers WHERE status = 'VISIBLE ONLINE') AS runnable_tasks,
    (SELECT SUM(context_switches_count) FROM sys.dm_os_schedulers WHERE status = 'VISIBLE ONLINE') AS context_switches
FROM (
    SELECT CAST(record AS XML) AS record, timestamp
    FROM sys.dm_os_ring_buffers
    WHERE ring_buffer_type = N'RING_BUFFER_SCHEDULER_MONITOR'
    AND record LIKE '%<SystemHealth>%'
) AS x
ORDER BY timestamp DESC`,
  collect: (rows, metrics) => {
    if (rows.length > 0) {
      const cpu_usage = rows[0][0].value;
      const runnable_tasks = rows[0][1].value;
      const context_switches = rows[0][2].value;

      metricsLog("Fetched CPU/Scheduler stats", "cpu_usage", cpu_usage, "runnable_tasks", runnable_tasks, "context_switches", context_switches);
      metrics.mssql_cpu_usage_percent.set(cpu_usage);
      metrics.mssql_scheduler_runnable_tasks_count.set(runnable_tasks);
      metrics.mssql_context_switches_count.set(context_switches);
    }
  },
};

// Database Growth & Capacity Planning
const mssql_database_size_growth = {
  metrics: {
    mssql_database_data_size_mb: new client.Gauge({
      name: "mssql_database_data_size_mb",
      help: "Database data file size in MB",
      labelNames: ["database"],
    }),
    mssql_database_log_size_mb: new client.Gauge({
      name: "mssql_database_log_size_mb",
      help: "Database log file size in MB",
      labelNames: ["database"],
    }),
    mssql_database_data_used_mb: new client.Gauge({
      name: "mssql_database_data_used_mb",
      help: "Database data space used in MB",
      labelNames: ["database"],
    }),
    mssql_database_data_free_mb: new client.Gauge({
      name: "mssql_database_data_free_mb",
      help: "Database data free space in MB",
      labelNames: ["database"],
    }),
  },
  query: `IF OBJECT_ID('tempdb..#Results') IS NOT NULL DROP TABLE #Results;

CREATE TABLE #Results (
    database_name NVARCHAR(128),
    data_size_mb DECIMAL(18,2),
    log_size_mb DECIMAL(18,2),
    data_used_mb DECIMAL(18,2),
    data_free_mb DECIMAL(18,2)
);

DECLARE @dbname NVARCHAR(128);
DECLARE @sql NVARCHAR(MAX);

DECLARE db_cursor CURSOR FOR
SELECT name FROM sys.databases WHERE database_id > 4 AND state = 0;

OPEN db_cursor;
FETCH NEXT FROM db_cursor INTO @dbname;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = N'USE [' + @dbname + N'];
    INSERT INTO #Results
    SELECT
        ''' + @dbname + N''' AS database_name,
        CAST(SUM(CASE WHEN type = 0 THEN size * 8 / 1024.0 ELSE 0 END) AS DECIMAL(18,2)) AS data_size_mb,
        CAST(SUM(CASE WHEN type = 1 THEN size * 8 / 1024.0 ELSE 0 END) AS DECIMAL(18,2)) AS log_size_mb,
        CAST(SUM(CASE WHEN type = 0 THEN CAST(FILEPROPERTY(name, ''SpaceUsed'') AS BIGINT) * 8 / 1024.0 ELSE 0 END) AS DECIMAL(18,2)) AS data_used_mb,
        CAST(SUM(CASE WHEN type = 0 THEN (size - CAST(FILEPROPERTY(name, ''SpaceUsed'') AS BIGINT)) * 8 / 1024.0 ELSE 0 END) AS DECIMAL(18,2)) AS data_free_mb
    FROM sys.database_files;';

    EXEC sp_executesql @sql;
    FETCH NEXT FROM db_cursor INTO @dbname;
END;

CLOSE db_cursor;
DEALLOCATE db_cursor;

SELECT * FROM #Results;

DROP TABLE #Results;`,
  collect: (rows, metrics) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const database = row[0].value;
      const data_size_mb = row[1].value;
      const log_size_mb = row[2].value;
      const data_used_mb = row[3].value;
      const data_free_mb = row[4].value;

      metricsLog("Fetched database size", database, "data_size", data_size_mb, "log_size", log_size_mb, "used", data_used_mb, "free", data_free_mb);
      metrics.mssql_database_data_size_mb.set({ database }, data_size_mb);
      metrics.mssql_database_log_size_mb.set({ database }, log_size_mb);
      metrics.mssql_database_data_used_mb.set({ database }, data_used_mb);
      metrics.mssql_database_data_free_mb.set({ database }, data_free_mb);
    }
  },
};

// Top Resource-Intensive Queries
const mssql_top_queries = {
  metrics: {
    mssql_query_execution_count: new client.Gauge({
      name: "mssql_query_execution_count",
      help: "Query execution count since last restart",
      labelNames: ["query_hash", "database"],
    }),
    mssql_query_total_cpu_ms: new client.Gauge({
      name: "mssql_query_total_cpu_ms",
      help: "Total CPU time for query in milliseconds",
      labelNames: ["query_hash", "database"],
    }),
    mssql_query_total_elapsed_ms: new client.Gauge({
      name: "mssql_query_total_elapsed_ms",
      help: "Total elapsed time for query in milliseconds",
      labelNames: ["query_hash", "database"],
    }),
    mssql_query_avg_elapsed_ms: new client.Gauge({
      name: "mssql_query_avg_elapsed_ms",
      help: "Average elapsed time per execution in milliseconds",
      labelNames: ["query_hash", "database"],
    }),
  },
  query: `SELECT TOP 20
    CONVERT(VARCHAR(50), qs.query_hash, 1) AS query_hash,
    ISNULL(DB_NAME(qt.dbid), 'N/A') AS database_name,
    qs.execution_count,
    qs.total_worker_time / 1000 AS total_cpu_ms,
    qs.total_elapsed_time / 1000 AS total_elapsed_ms,
    (qs.total_elapsed_time / qs.execution_count) / 1000 AS avg_elapsed_ms
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) AS qt
WHERE qs.query_hash IS NOT NULL
ORDER BY qs.total_elapsed_time DESC`,
  collect: (rows, metrics) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const query_hash = row[0].value;
      const database = row[1].value;
      const execution_count = row[2].value;
      const total_cpu_ms = row[3].value;
      const total_elapsed_ms = row[4].value;
      const avg_elapsed_ms = row[5].value;

      metricsLog("Fetched top query", "hash", query_hash, "db", database, "exec_count", execution_count, "avg_ms", avg_elapsed_ms);
      metrics.mssql_query_execution_count.set({ query_hash, database }, execution_count);
      metrics.mssql_query_total_cpu_ms.set({ query_hash, database }, total_cpu_ms);
      metrics.mssql_query_total_elapsed_ms.set({ query_hash, database }, total_elapsed_ms);
      metrics.mssql_query_avg_elapsed_ms.set({ query_hash, database }, avg_elapsed_ms);
    }
  },
};

// Missing Indexes
const mssql_missing_indexes = {
  metrics: {
    mssql_missing_index_impact: new client.Gauge({
      name: "mssql_missing_index_impact",
      help: "Missing index improvement measure",
      labelNames: ["database", "table", "index_handle"],
    }),
  },
  query: `SELECT TOP 20
    DB_NAME(d.database_id) AS database_name,
    OBJECT_NAME(d.object_id, d.database_id) AS table_name,
    CONVERT(VARCHAR(50), d.index_handle) AS index_handle,
    (s.avg_total_user_cost * s.avg_user_impact * (s.user_seeks + s.user_scans)) AS improvement_measure
FROM sys.dm_db_missing_index_details d
INNER JOIN sys.dm_db_missing_index_groups g ON d.index_handle = g.index_handle
INNER JOIN sys.dm_db_missing_index_group_stats s ON g.index_group_handle = s.group_handle
WHERE d.database_id > 4
ORDER BY improvement_measure DESC`,
  collect: (rows, metrics) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const database = row[0].value;
      const table = row[1].value;
      const index_handle = row[2].value;
      const impact = row[3].value;

      metricsLog("Fetched missing index", "db", database, "table", table, "impact", impact);
      metrics.mssql_missing_index_impact.set({ database, table, index_handle }, impact);
    }
  },
};

// Index Fragmentation
const mssql_index_fragmentation = {
  metrics: {
    mssql_index_fragmentation_percent: new client.Gauge({
      name: "mssql_index_fragmentation_percent",
      help: "Index fragmentation percentage",
      labelNames: ["database", "table", "index_name"],
    }),
    mssql_index_page_count: new client.Gauge({
      name: "mssql_index_page_count",
      help: "Number of pages in index",
      labelNames: ["database", "table", "index_name"],
    }),
  },
  query: `DECLARE @results TABLE (
    database_name NVARCHAR(128),
    table_name NVARCHAR(128),
    index_name NVARCHAR(128),
    fragmentation_percent DECIMAL(5,2),
    page_count BIGINT
);

DECLARE @db_name NVARCHAR(128);
DECLARE @sql NVARCHAR(MAX);

DECLARE db_cursor CURSOR FOR
SELECT name FROM sys.databases WHERE database_id > 4 AND state = 0;

OPEN db_cursor;
FETCH NEXT FROM db_cursor INTO @db_name;

WHILE @@FETCH_STATUS = 0
BEGIN
    BEGIN TRY
        SET @sql = N'USE [' + @db_name + N'];
        INSERT INTO @results
        SELECT TOP 20
            DB_NAME() AS database_name,
            OBJECT_NAME(ips.object_id) AS table_name,
            i.name AS index_name,
            ips.avg_fragmentation_in_percent,
            ips.page_count
        FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, ''LIMITED'') ips
        INNER JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
        WHERE ips.avg_fragmentation_in_percent > 10
        AND ips.page_count > 100
        AND i.name IS NOT NULL
        ORDER BY ips.avg_fragmentation_in_percent DESC';

        EXEC sp_executesql @sql;
    END TRY
    BEGIN CATCH
        -- Skip databases that have errors
    END CATCH

    FETCH NEXT FROM db_cursor INTO @db_name;
END

CLOSE db_cursor;
DEALLOCATE db_cursor;

SELECT * FROM @results;`,
  collect: (rows, metrics) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const database = row[0].value;
      const table = row[1].value;
      const index_name = row[2].value;
      const fragmentation = row[3].value;
      const page_count = row[4].value;

      metricsLog("Fetched index fragmentation", "db", database, "table", table, "index", index_name, "frag%", fragmentation);
      metrics.mssql_index_fragmentation_percent.set({ database, table, index_name }, fragmentation);
      metrics.mssql_index_page_count.set({ database, table, index_name }, page_count);
    }
  },
};

// Long Running Sessions
const mssql_long_running_sessions = {
  metrics: {
    mssql_long_running_session_count: new client.Gauge({
      name: "mssql_long_running_session_count",
      help: "Number of sessions running longer than threshold",
    }),
    mssql_long_running_session_duration_seconds: new client.Gauge({
      name: "mssql_long_running_session_duration_seconds",
      help: "Duration of long running sessions in seconds",
      labelNames: ["session_id", "database", "status"],
    }),
  },
  query: `SELECT
    COUNT(*) AS long_session_count,
    s.session_id,
    ISNULL(DB_NAME(r.database_id), 'N/A') AS database_name,
    r.status,
    DATEDIFF(SECOND, r.start_time, GETDATE()) AS duration_seconds
FROM sys.dm_exec_sessions s
LEFT JOIN sys.dm_exec_requests r ON s.session_id = r.session_id
WHERE s.is_user_process = 1
AND r.start_time IS NOT NULL
AND DATEDIFF(MINUTE, r.start_time, GETDATE()) > 5
GROUP BY s.session_id, r.database_id, r.status, r.start_time`,
  collect: (rows, metrics) => {
    const total_count = rows.length;
    metrics.mssql_long_running_session_count.set(total_count);
    metricsLog("Fetched long running sessions", "count", total_count);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const session_id = row[1].value.toString();
      const database = row[2].value;
      const status = row[3].value;
      const duration = row[4].value;

      metrics.mssql_long_running_session_duration_seconds.set({ session_id, database, status }, duration);
    }
  },
};

// Disk Latency
const mssql_disk_latency = {
  metrics: {
    mssql_disk_read_latency_ms: new client.Gauge({
      name: "mssql_disk_read_latency_ms",
      help: "Average disk read latency in milliseconds",
      labelNames: ["database", "file_type"],
    }),
    mssql_disk_write_latency_ms: new client.Gauge({
      name: "mssql_disk_write_latency_ms",
      help: "Average disk write latency in milliseconds",
      labelNames: ["database", "file_type"],
    }),
  },
  query: `SELECT
    DB_NAME(vfs.database_id) AS database_name,
    CASE WHEN mf.type = 0 THEN 'DATA' ELSE 'LOG' END AS file_type,
    CASE WHEN vfs.num_of_reads = 0 THEN 0 ELSE (vfs.io_stall_read_ms / vfs.num_of_reads) END AS read_latency_ms,
    CASE WHEN vfs.num_of_writes = 0 THEN 0 ELSE (vfs.io_stall_write_ms / vfs.num_of_writes) END AS write_latency_ms
FROM sys.dm_io_virtual_file_stats(NULL, NULL) vfs
INNER JOIN sys.master_files mf ON vfs.database_id = mf.database_id AND vfs.file_id = mf.file_id
WHERE vfs.database_id > 4`,
  collect: (rows, metrics) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const database = row[0].value;
      const file_type = row[1].value;
      const read_latency = row[2].value;
      const write_latency = row[3].value;

      metricsLog("Fetched disk latency", "db", database, "type", file_type, "read_ms", read_latency, "write_ms", write_latency);
      metrics.mssql_disk_read_latency_ms.set({ database, file_type }, read_latency);
      metrics.mssql_disk_write_latency_ms.set({ database, file_type }, write_latency);
    }
  },
};

// Buffer Cache Hit Ratio
const mssql_buffer_cache_hit_ratio = {
  metrics: {
    mssql_buffer_cache_hit_ratio_percent: new client.Gauge({
      name: "mssql_buffer_cache_hit_ratio_percent",
      help: "Buffer cache hit ratio percentage",
    }),
  },
  query: `SELECT
    (CAST(cntr_value AS DECIMAL(16,2)) /
     (SELECT cntr_value FROM sys.dm_os_performance_counters
      WHERE counter_name = 'Buffer cache hit ratio base'
      AND object_name LIKE '%Buffer Manager%')) * 100 AS hit_ratio_percent
FROM sys.dm_os_performance_counters
WHERE counter_name = 'Buffer cache hit ratio'
AND object_name LIKE '%Buffer Manager%'`,
  collect: (rows, metrics) => {
    if (rows.length > 0) {
      const hit_ratio = rows[0][0].value;
      metricsLog("Fetched buffer cache hit ratio", hit_ratio);
      metrics.mssql_buffer_cache_hit_ratio_percent.set(hit_ratio);
    }
  },
};

// Blocking Chain Details
const mssql_blocking_details = {
  metrics: {
    mssql_blocking_session_id: new client.Gauge({
      name: "mssql_blocking_session_id",
      help: "Blocking session ID information",
      labelNames: ["blocked_session_id", "blocking_session_id", "database", "wait_type"],
    }),
  },
  query: `SELECT
    r.session_id AS blocked_session_id,
    r.blocking_session_id,
    ISNULL(DB_NAME(r.database_id), 'N/A') AS database_name,
    r.wait_type,
    r.wait_time
FROM sys.dm_exec_requests r
WHERE r.blocking_session_id <> 0`,
  collect: (rows, metrics) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const blocked_session = row[0].value.toString();
      const blocking_session = row[1].value.toString();
      const database = row[2].value;
      const wait_type = row[3].value;
      const wait_time = row[4].value;

      metricsLog("Fetched blocking chain", "blocked", blocked_session, "blocker", blocking_session, "wait", wait_time);
      metrics.mssql_blocking_session_id.set({ blocked_session_id: blocked_session, blocking_session_id: blocking_session, database, wait_type }, wait_time);
    }
  },
};

// Statistics Age
const mssql_statistics_age = {
  metrics: {
    mssql_statistics_days_old: new client.Gauge({
      name: "mssql_statistics_days_old",
      help: "Days since statistics were last updated",
      labelNames: ["database", "table", "stats_name"],
    }),
  },
  query: `DECLARE @results TABLE (
    database_name NVARCHAR(128),
    table_name NVARCHAR(128),
    stats_name NVARCHAR(128),
    days_old INT
);

DECLARE @db_name NVARCHAR(128);
DECLARE @sql NVARCHAR(MAX);

DECLARE db_cursor CURSOR FOR
SELECT name FROM sys.databases WHERE database_id > 4 AND state = 0;

OPEN db_cursor;
FETCH NEXT FROM db_cursor INTO @db_name;

WHILE @@FETCH_STATUS = 0
BEGIN
    BEGIN TRY
        SET @sql = N'USE [' + @db_name + N'];
        INSERT INTO @results
        SELECT TOP 50
            DB_NAME() AS database_name,
            OBJECT_NAME(s.object_id) AS table_name,
            s.name AS stats_name,
            DATEDIFF(DAY, sp.last_updated, GETDATE()) AS days_old
        FROM sys.stats s
        CROSS APPLY sys.dm_db_stats_properties(s.object_id, s.stats_id) sp
        WHERE DATEDIFF(DAY, sp.last_updated, GETDATE()) > 7
        ORDER BY days_old DESC';

        EXEC sp_executesql @sql;
    END TRY
    BEGIN CATCH
        -- Skip databases with errors
    END CATCH

    FETCH NEXT FROM db_cursor INTO @db_name;
END

CLOSE db_cursor;
DEALLOCATE db_cursor;

SELECT * FROM @results;`,
  collect: (rows, metrics) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const database = row[0].value;
      const table = row[1].value;
      const stats_name = row[2].value;
      const days_old = row[3].value;

      metricsLog("Fetched statistics age", "db", database, "table", table, "stats", stats_name, "days", days_old);
      metrics.mssql_statistics_days_old.set({ database, table, stats_name }, days_old);
    }
  },
};

const entries = {
  mssql_up,
  mssql_product_version,
  mssql_instance_local_time,
  mssql_connections,
  mssql_client_connections,
  mssql_deadlocks,
  mssql_user_errors,
  mssql_kill_connection_errors,
  mssql_database_state,
  mssql_log_growths,
  mssql_database_filesize,
  mssql_buffer_manager,
  mssql_io_stall,
  mssql_batch_requests,
  mssql_transactions,
  mssql_os_process_memory,
  mssql_os_sys_memory,
  mssql_sql_agent_jobs,
  mssql_database_backups,
  mssql_availability_groups,
  mssql_blocking_sessions,
  mssql_wait_stats,
  mssql_database_properties,
  mssql_tempdb_stats,
  mssql_transaction_log_stats,
  mssql_security_stats,
  mssql_cpu_scheduler_stats,
  mssql_database_size_growth,
  mssql_top_queries,
  mssql_missing_indexes,
  mssql_index_fragmentation,
  mssql_long_running_sessions,
  mssql_disk_latency,
  mssql_buffer_cache_hit_ratio,
  mssql_blocking_details,
  mssql_statistics_age,
};

module.exports = {
  entries,
};
