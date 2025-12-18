# Prometheus MSSQL Exporter Docker Container

Prometheus exporter for Microsoft SQL Server (MSSQL). Exposes the following metrics

## Core Metrics
- mssql_up UP Status
- mssql_product_version Instance version (Major.Minor)
- mssql_instance_local_time Number of seconds since epoch on local instance

## Connection Metrics
- mssql_connections{database,state} Number of active connections
- mssql_client_connections{client,database} Number of active client connections

## Error Metrics
- mssql_deadlocks Number of lock requests per second that resulted in a deadlock since last restart
- mssql_user_errors Number of user errors/sec since last restart
- mssql_kill_connection_errors Number of kill connection errors/sec since last restart

## Database Metrics
- mssql_database_state{database} Databases states: 0=ONLINE 1=RESTORING 2=RECOVERING 3=RECOVERY_PENDING 4=SUSPECT 5=EMERGENCY 6=OFFLINE 7=COPYING 10=OFFLINE_SECONDARY
- mssql_log_growths{database} Total number of times the transaction log for the database has been expanded last restart
- mssql_database_filesize{database,logicalname,type,filename} Physical sizes of files used by database in KB, their names and types (0=rows, 1=log, 2=filestream,3=n/a 4=fulltext(before v2008 of MSSQL))

## Database Properties
- mssql_database_recovery_model{database} Database recovery model (1=FULL, 2=BULK_LOGGED, 3=SIMPLE)
- mssql_database_compatibility_level{database} Database compatibility level
- mssql_database_auto_close{database} Database auto close setting (0=OFF, 1=ON)
- mssql_database_auto_shrink{database} Database auto shrink setting (0=OFF, 1=ON)
- mssql_database_page_verify{database} Database page verify option (0=NONE, 1=TORN_PAGE_DETECTION, 2=CHECKSUM)

## Buffer Manager Metrics
- mssql_page_read_total Page reads/sec
- mssql_page_write_total Page writes/sec
- mssql_page_life_expectancy Indicates the minimum number of seconds a page will stay in the buffer pool on this node without references. The traditional advice from Microsoft used to be that the PLE should remain above 300 seconds
- mssql_lazy_write_total Lazy writes/sec
- mssql_page_checkpoint_total Checkpoint pages/sec

## I/O Metrics
- mssql_io_stall{database,type} Wait time (ms) of stall since last restart
- mssql_io_stall_total{database} Wait time (ms) of stall since last restart

## Transaction Metrics
- mssql_batch_requests Number of Transact-SQL command batches received per second. This statistic is affected by all constraints (such as I/O, number of users, cachesize, complexity of requests, and so on). High batch requests mean good throughput
- mssql_transactions{database} Number of transactions started for the database per second. Transactions/sec does not count XTP-only transactions (transactions started by a natively compiled stored procedure.)

## Memory Metrics
- mssql_page_fault_count Number of page faults since last restart
- mssql_memory_utilization_percentage Percentage of memory utilization
- mssql_total_physical_memory_kb Total physical memory in KB
- mssql_available_physical_memory_kb Available physical memory in KB
- mssql_total_page_file_kb Total page file in KB
- mssql_available_page_file_kb Available page file in KB

## SQL Agent Job Metrics
- mssql_sql_agent_job_status{job_name,job_id} SQL Agent job last run status (-1=Never Run, 0=Failed, 1=Succeeded, 2=Retry, 3=Canceled, 4=In Progress)
- mssql_sql_agent_job_enabled{job_name,job_id} SQL Agent job enabled status (0=Disabled, 1=Enabled)
- mssql_sql_agent_job_last_run_seconds{job_name,job_id} SQL Agent job last run time in seconds since epoch
- mssql_sql_agent_job_next_run_seconds{job_name,job_id} SQL Agent job next scheduled run time in seconds since epoch
- mssql_sql_agent_job_last_duration_seconds{job_name,job_id} SQL Agent job last run duration in seconds

## Backup Metrics
- mssql_database_backup_last_full_seconds{database} Last full backup time in seconds since epoch
- mssql_database_backup_last_diff_seconds{database} Last differential backup time in seconds since epoch
- mssql_database_backup_last_log_seconds{database} Last transaction log backup time in seconds since epoch
- mssql_database_backup_age_full_hours{database} Hours since last full backup
- mssql_database_backup_age_diff_hours{database} Hours since last differential backup
- mssql_database_backup_age_log_hours{database} Hours since last transaction log backup
- mssql_database_backup_size_mb{database,type} Last backup size in MB

## AlwaysOn Availability Groups Metrics
- mssql_ag_replica_role{ag_name,replica_server} Availability group replica role (0=Resolving, 1=Primary, 2=Secondary)
- mssql_ag_replica_sync_state{ag_name,replica_server,database} Availability group replica synchronization state (0=NotSynchronizing, 1=Synchronizing, 2=Synchronized, 3=Reverting, 4=Initializing)
- mssql_ag_replica_sync_health{ag_name,replica_server} Availability group replica synchronization health (0=NotHealthy, 1=PartiallyHealthy, 2=Healthy)
- mssql_ag_log_send_queue_size_kb{ag_name,replica_server,database} Availability group log send queue size in KB
- mssql_ag_redo_queue_size_kb{ag_name,replica_server,database} Availability group redo queue size in KB

## Blocking & Wait Metrics
- mssql_blocked_session_count Number of currently blocked sessions
- mssql_blocking_session_wait_time_ms{database,wait_type} Wait time in milliseconds for blocked sessions
- mssql_wait_time_ms{wait_type,category} Wait time in milliseconds by wait type since last restart
- mssql_wait_count{wait_type,category} Number of waits by wait type since last restart

## TempDB Metrics
- mssql_tempdb_file_count Number of TempDB data files
- mssql_tempdb_file_size_kb{file_name,file_type} TempDB file size in KB
- mssql_tempdb_space_used_kb{file_name} TempDB space used in KB
- mssql_tempdb_version_store_mb TempDB version store size in MB

## Transaction Log Metrics
- mssql_log_space_used_percent{database} Transaction log space used percentage
- mssql_log_space_used_mb{database} Transaction log space used in MB
- mssql_log_space_total_mb{database} Transaction log total space in MB
- mssql_log_reuse_wait{database} Transaction log reuse wait reason
- mssql_log_vlf_count{database} Virtual log file count

## Security & Audit Metrics
- mssql_failed_login_count Number of failed login attempts

## CPU & Scheduler Metrics
- mssql_cpu_usage_percent SQL Server CPU usage percentage
- mssql_scheduler_runnable_tasks_count Number of runnable tasks waiting on schedulers
- mssql_context_switches_count Number of context switches since last restart

Please feel free to submit other interesting metrics to include.

> This exporter has been tested against MSSQL 2017 and 2019 docker images (only ones offered by Microsoft). Other versions might be work but have not been tested.

## Usage

`docker run -e SERVER=192.168.56.101 -e USERNAME=SA -e PASSWORD=qkD4x3yy -e DEBUG=app -p 4000:4000 --name prometheus-mssql-exporter awaragi/prometheus-mssql-exporter`

The image supports the following environments and exposes port 4000

- **SERVER** server ip or dns name (required)
- **PORT** server port (optional defaults to 1433)
- **USERNAME** access user (required)
- **PASSWORD** access password (required)
- **ENCRYPT** force [encrypt](https://docs.microsoft.com/en-us/dotnet/api/system.data.sqlclient.sqlconnectionstringbuilder.encrypt?view=dotnet-plat-ext-6.0) setting (optional defaults to true)
- **TRUST_SERVER_CERTIFICATE** sets [trustServerCertificate](https://docs.microsoft.com/en-us/dotnet/api/system.data.sqlclient.sqlconnectionstringbuilder.trustservercertificate?view=dotnet-plat-ext-6.0) setting (optional defaults to true)
- **DEBUG** comma delimited list of enabled logs (optional currently supports app and metrics)

## Required Permissions

The exporter requires specific permissions to collect all available metrics. You can use the provided [setup-permissions.sql](setup-permissions.sql) script to grant all required permissions automatically, or grant them manually as shown below.

### Quick Setup

Replace `[monitoring]` with your actual SQL user/login name and execute the [setup-permissions.sql](setup-permissions.sql) script on your SQL Server instance.

### Manual Permissions Setup

If you prefer to grant permissions manually, execute the following:

**Master Database Permissions:**
```sql
USE master;
GO
GRANT VIEW SERVER STATE TO [your_user];
GRANT VIEW ANY DEFINITION TO [your_user];
GO
```

**MSDB Database Permissions** (required for SQL Agent Jobs and Backup metrics):
```sql
USE msdb;
GO
GRANT SELECT ON dbo.sysjobs TO [your_user];
GRANT SELECT ON dbo.sysjobhistory TO [your_user];
GRANT SELECT ON dbo.sysjobschedules TO [your_user];
GRANT SELECT ON dbo.sysschedules TO [your_user];
GRANT SELECT ON dbo.backupset TO [your_user];
GO
```

**TempDB Permissions** (required for TempDB metrics):
```sql
USE tempdb;
GO
GRANT VIEW DATABASE STATE TO [your_user];
GO
```

### What These Permissions Enable

- **VIEW SERVER STATE**: Required for most Dynamic Management Views (sys.dm_*)
- **VIEW ANY DEFINITION**: Required to query system metadata and catalog views
- **MSDB SELECT permissions**: Enable SQL Agent job monitoring and backup history metrics
- **TempDB VIEW DATABASE STATE**: Enable TempDB space and file metrics

See the [setup-permissions.sql](setup-permissions.sql) script for a complete setup including verification queries.

## Frequently Asked Questions (FAQ)

### Unable to connect to database / Connection timeout

Raised in [issue #19](https://github.com/awaragi/prometheus-mssql-exporter/issues/19)

**Named Instance Issue:**
If your SQL Server is configured as a named instance (e.g., `SERVER\INSTANCENAME`), the TCP port is dynamically assigned by default, which can cause connection issues.

**Solutions:**

1. **Use a static port (Recommended):**
   Configure your SQL Server to listen on a specific TCP port:
   - Open SQL Server Configuration Manager
   - Navigate to SQL Server Network Configuration → Protocols for [Instance Name]
   - Right-click TCP/IP → Properties → IP Addresses tab
   - Set "TCP Dynamic Ports" to blank and "TCP Port" to a specific port (e.g., 1433)
   - Restart SQL Server service
   - Use the PORT environment variable: `docker run -e PORT=1433 ...`

2. **Use the default instance:**
   If possible, use the default SQL Server instance instead of a named instance.

3. **Enable TCP/IP protocol:**
   Ensure TCP/IP is enabled in SQL Server Configuration Manager:
   - SQL Server Network Configuration → Protocols for [Instance Name]
   - Right-click TCP/IP → Enable

For detailed instructions, see [Microsoft's documentation](https://docs.microsoft.com/en-US/sql/database-engine/configure-windows/configure-a-server-to-listen-on-a-specific-tcp-port?view=sql-server-ver15).

### Running multiple instances of exporter

Raised in [issue #20](https://github.com/awaragi/prometheus-mssql-exporter/issues/20)

Each container should use its own docker port forward (e.g. -p 4001:4000 and -p 4002:4000)

### What Grafana dashboard can I use

Here are some suggestions on available Grafana dashboards. If you are an author or such dashboard and want to have it referenced here, simply create a Pull Request.

- https://grafana.com/grafana/dashboards/13919

### Running in the background

Use `docker run -d ...` to run the container in background

## Development

## Launching a test mssql server

To launch a local mssql instance to test against

```shell
npm run test:mssql:2019
# or
npm run test:mssql:2017
```

To use a persistent storage add `-v /<mypath>:/var/opt/mssql/data` to the command line.

## List all available metrics

To list all available metrics and the used queries to generate these metrics - say for for DBA validation, use the following command

```shell
npm run metrics
```

## Environment variables

- SERVER: sqlserver
- PORT: sql server port (optional defaults to 1433)
- USERNAME: sql server user (should have admin or user with required permissions)
- PASSWORD: sql user password
- ENCRYPT: force [encrypt](https://docs.microsoft.com/en-us/dotnet/api/system.data.sqlclient.sqlconnectionstringbuilder.encrypt?view=dotnet-plat-ext-6.0) setting (optional defaults to true)
- TRUST_SERVER_CERTIFICATE: sets [trustServerCertificate](https://docs.microsoft.com/en-us/dotnet/api/system.data.sqlclient.sqlconnectionstringbuilder.trustservercertificate?view=dotnet-plat-ext-6.0) setting (optional defaults to true)
- EXPOSE: webserver port (defaults to 4000)
- DEBUG: verbose logging
  - app for application logging
  - metrics for metrics executions logging
  - db for database connection logging
  - queries for database queries and results logging

## Launch via command line

### Using NodeJS

To execute and the application using locally running mssql (see above for how to launch a docker instance of mssql),
use the following command which will generate all a detailed logs

```shell
npm start
```

A more verbose execution with all queries and their results printed out

```shell
npm run start:verbose
```

### Using Docker

To build and launch your docker image use the following command

```shell
npm run docker:run
```

## Testing

### Curl or Browser

Use curl or wget to fetch the metrics from launched web application.

```shell
curl http://localhost:4000/metrics
```

### E2E Test with Expectations

E2E test is available to execute against MSSQL 2017 or 2019 docker instances.

The test does not care about the values of the metrics but checks the presence of all expected keys.

To add new metrics, the E2E must get updated with their keys to pass.

```shell
npm test
```

## building and pushing image to dockerhub

Use `docker build` and `docker push` or the bundled Github Workflows/Actions (see .github/workflows)
