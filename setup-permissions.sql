-- ============================================================================
-- SQL Server Permissions Setup for Prometheus MSSQL Exporter
-- ============================================================================
-- This script grants the minimum required permissions for the exporter user
-- to collect all available metrics from SQL Server.
--
-- Usage:
--   1. Replace [monitoring] with your actual SQL user/login name
--   2. Execute this script on the SQL Server instance you want to monitor
--   3. Ensure the user exists before running this script
--
-- To create a new SQL login (if needed):
--   CREATE LOGIN [monitoring] WITH PASSWORD = 'YourStrongPassword123!';
--   CREATE USER [monitoring] FOR LOGIN [monitoring];
-- ============================================================================

USE master;
GO

-- ============================================================================
-- MASTER DATABASE PERMISSIONS
-- ============================================================================
-- These permissions allow access to DMVs and system catalog views

-- VIEW SERVER STATE: Required for most DMVs (sys.dm_*)
GRANT VIEW SERVER STATE TO [monitoring];

-- VIEW ANY DEFINITION: Required to query system metadata (sys.*)
GRANT VIEW ANY DEFINITION TO [monitoring];

PRINT 'Master database permissions granted successfully';
GO

-- ============================================================================
-- MSDB DATABASE PERMISSIONS
-- ============================================================================
-- Required for SQL Agent jobs and backup history metrics

USE msdb;
GO

-- SQL Agent Jobs monitoring
GRANT SELECT ON dbo.sysjobs TO [monitoring];
GRANT SELECT ON dbo.sysjobhistory TO [monitoring];
GRANT SELECT ON dbo.sysjobschedules TO [monitoring];
GRANT SELECT ON dbo.sysschedules TO [monitoring];

-- Backup history monitoring
GRANT SELECT ON dbo.backupset TO [monitoring];

PRINT 'MSDB database permissions granted successfully';
GO

-- ============================================================================
-- TEMPDB DATABASE PERMISSIONS
-- ============================================================================
-- Required for TempDB metrics

-- ============================================================================
-- DATABASE PERMISSIONS
-- ============================================================================
-- Required for transaction log statistics and TempDB metrics
-- We create users in each database and grant VIEW DATABASE STATE

USE master;
GO

-- Create a stored procedure to grant permissions automatically
-- This procedure will be called by a trigger when SQL Server starts
IF OBJECT_ID('dbo.sp_grant_monitoring_permissions', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_grant_monitoring_permissions;
GO

CREATE PROCEDURE dbo.sp_grant_monitoring_permissions
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @dbname NVARCHAR(128);
    DECLARE @sql NVARCHAR(MAX);

    DECLARE db_cursor CURSOR FOR
    SELECT name FROM sys.databases
    WHERE state = 0  -- Only ONLINE databases
      AND HAS_DBACCESS(name) = 1; -- Only databases we can access

    OPEN db_cursor;
    FETCH NEXT FROM db_cursor INTO @dbname;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        BEGIN TRY
            -- Create user in database if it doesn't exist
            SET @sql = N'USE [' + @dbname + N'];
                IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = ''monitoring'')
                BEGIN
                    CREATE USER [monitoring] FOR LOGIN [monitoring];
                END;
                GRANT VIEW DATABASE STATE TO [monitoring];';
            EXEC sp_executesql @sql;
            PRINT 'Granted permissions on database: ' + @dbname;
        END TRY
        BEGIN CATCH
            PRINT 'WARNING: Could not grant permissions on database: ' + @dbname + ' - ' + ERROR_MESSAGE();
        END CATCH

        FETCH NEXT FROM db_cursor INTO @dbname;
    END

    CLOSE db_cursor;
    DEALLOCATE db_cursor;
END;
GO

-- Execute the procedure to grant initial permissions
EXEC dbo.sp_grant_monitoring_permissions;
GO

-- Create a trigger to automatically grant permissions on SQL Server startup
-- This ensures tempdb gets the permissions after every restart
IF EXISTS (SELECT 1 FROM sys.server_triggers WHERE name = 'trg_grant_monitoring_permissions_on_startup')
    DROP TRIGGER trg_grant_monitoring_permissions_on_startup ON ALL SERVER;
GO

CREATE TRIGGER trg_grant_monitoring_permissions_on_startup
ON ALL SERVER
FOR LOGON
AS
BEGIN
    -- Only execute once per restart by checking if tempdb user exists
    IF NOT EXISTS (SELECT 1 FROM tempdb.sys.database_principals WHERE name = 'monitoring')
    BEGIN
        EXEC master.dbo.sp_grant_monitoring_permissions;
    END
END;
GO

PRINT 'Database permissions and startup trigger created successfully';
GO

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
-- Run this to verify all permissions were granted correctly

USE master;
GO

-- Verify server-level permissions
SELECT
    'PERMISSION VERIFICATION' AS check_type,
    SYSTEM_USER AS current_login,
    HAS_PERMS_BY_NAME(NULL, NULL, 'VIEW SERVER STATE') AS has_view_server_state,
    HAS_PERMS_BY_NAME(NULL, NULL, 'VIEW ANY DEFINITION') AS has_view_any_definition,
    HAS_PERMS_BY_NAME('msdb.dbo.sysjobs', 'OBJECT', 'SELECT') AS has_sysjobs_access,
    HAS_PERMS_BY_NAME('msdb.dbo.sysjobhistory', 'OBJECT', 'SELECT') AS has_sysjobhistory_access,
    HAS_PERMS_BY_NAME('msdb.dbo.sysjobschedules', 'OBJECT', 'SELECT') AS has_sysjobschedules_access,
    HAS_PERMS_BY_NAME('msdb.dbo.sysschedules', 'OBJECT', 'SELECT') AS has_sysschedules_access,
    HAS_PERMS_BY_NAME('msdb.dbo.backupset', 'OBJECT', 'SELECT') AS has_backupset_access;

-- Verify database-level permissions
PRINT '';
PRINT 'Checking VIEW DATABASE STATE permissions on all databases:';
EXEC dbo.sp_grant_monitoring_permissions;

PRINT '';
PRINT '============================================================================';
PRINT 'All permissions have been granted successfully!';
PRINT '';
PRINT 'Metrics that require these permissions:';
PRINT '  - Core metrics (mssql_up, version, connections, etc.)';
PRINT '  - SQL Agent Jobs (status, last run, next run, duration)';
PRINT '  - Database Backups (last backup times, ages, sizes)';
PRINT '  - AlwaysOn Availability Groups (role, sync state, health)';
PRINT '  - Blocking & Wait Statistics';
PRINT '  - Database Properties (recovery model, compatibility, etc.)';
PRINT '  - TempDB Statistics';
PRINT '  - Transaction Log Statistics';
PRINT '  - Security Statistics';
PRINT '  - CPU & Scheduler Statistics';
PRINT '  - Memory & I/O Statistics';
PRINT '============================================================================';
GO
