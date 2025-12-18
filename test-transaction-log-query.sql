-- Test query for transaction log statistics
-- Run this as the monitoring user to see if it works

CREATE TABLE #logspace (
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

DROP TABLE #logspace;
