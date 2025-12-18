-- Test query for transaction log statistics
-- Run this as the monitoring user to see if it works

SELECT
    DB_NAME(ls.database_id) AS database_name,
    CAST(ls.used_log_space_in_bytes / 1024.0 / 1024.0 AS DECIMAL(18,2)) AS log_space_used_mb,
    CAST(mf.size * 8.0 / 1024.0 AS DECIMAL(18,2)) AS log_space_total_mb,
    CAST((ls.used_log_space_in_bytes * 100.0) / NULLIF(CAST(mf.size AS BIGINT) * 8 * 1024, 0) AS DECIMAL(5,2)) AS log_space_used_percent,
    d.log_reuse_wait,
    (SELECT COUNT(*) FROM sys.dm_db_log_info(ls.database_id)) AS vlf_count
FROM sys.dm_db_log_space_usage ls
INNER JOIN sys.databases d ON ls.database_id = d.database_id
INNER JOIN sys.master_files mf ON ls.database_id = mf.database_id AND mf.type = 1
WHERE ls.database_id > 4
  AND d.state = 0;
