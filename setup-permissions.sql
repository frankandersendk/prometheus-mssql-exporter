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

USE tempdb;
GO

-- Grant access to tempdb system views
GRANT VIEW DATABASE STATE TO [monitoring];

PRINT 'TempDB database permissions granted successfully';
GO

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
-- Run this to verify all permissions were granted correctly

USE master;
GO

SELECT
    'PERMISSION VERIFICATION' AS check_type,
    USER_NAME() AS current_user,
    HAS_PERMS_BY_NAME(NULL, NULL, 'VIEW SERVER STATE') AS has_view_server_state,
    HAS_PERMS_BY_NAME(NULL, NULL, 'VIEW ANY DEFINITION') AS has_view_any_definition,
    HAS_PERMS_BY_NAME('msdb.dbo.sysjobs', 'OBJECT', 'SELECT') AS has_sysjobs_access,
    HAS_PERMS_BY_NAME('msdb.dbo.sysjobhistory', 'OBJECT', 'SELECT') AS has_sysjobhistory_access,
    HAS_PERMS_BY_NAME('msdb.dbo.sysjobschedules', 'OBJECT', 'SELECT') AS has_sysjobschedules_access,
    HAS_PERMS_BY_NAME('msdb.dbo.sysschedules', 'OBJECT', 'SELECT') AS has_sysschedules_access,
    HAS_PERMS_BY_NAME('msdb.dbo.backupset', 'OBJECT', 'SELECT') AS has_backupset_access;

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
