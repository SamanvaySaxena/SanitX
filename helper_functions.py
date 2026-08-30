dangerous_sql_queries = [
    # --- Standard & Conditional DML Deletions ---
    "DELETE FROM {table} WHERE {condition};",
    "DELETE FROM {table};",
    "DELETE FROM {table} WHERE {column} IN (SELECT {column} FROM {other_table} WHERE {condition});",
    "DELETE FROM {table} WHERE EXISTS (SELECT 1 FROM {other_table} WHERE {join_condition});",
    "DELETE FROM {table} WHERE {column} NOT IN (SELECT {column} FROM {other_table});",

    # --- Multi-Table & JOIN Deletions ---
    "DELETE {alias} FROM {table} {alias} INNER JOIN {other_table} ON {join_condition} WHERE {condition};",
    "DELETE FROM {table} USING {other_table} WHERE {join_condition} AND {condition};",

    # --- CTE & Subquery Deletions ---
    "WITH cte AS (SELECT {cols}, ROW_NUMBER() OVER (PARTITION BY {partition_col} ORDER BY {order_col}) AS rn FROM {table}) DELETE FROM cte WHERE rn > 1;",
    "DELETE FROM (SELECT * FROM {table} WHERE {condition}) WHERE {inner_condition};",

    # --- Output & Returning Clauses ---
    "DELETE FROM {table} WHERE {condition} RETURNING *;",
    "DELETE FROM {table} OUTPUT deleted.* WHERE {condition};",

    # --- Limits and Dialect-Specific Variations ---
    "DELETE FROM {table} WHERE {condition} LIMIT {limit_number};",
    "DELETE TOP ({limit_number}) FROM {table} WHERE {condition};",
    "DELETE TOP ({percent_number}) PERCENT FROM {table} WHERE {condition};",
    "DELETE FROM ONLY {parent_table} WHERE {condition};",

    # --- Cursor / Programmatic Deletion ---
    "DELETE FROM {table} WHERE CURRENT OF {cursor_name};",

    # --- Merge / Upsert Operations ---
    "MERGE INTO {target_table} t USING {source_table} s ON ({join_condition}) WHEN MATCHED AND {condition} THEN DELETE;",
    "REPLACE INTO {table} ({columns}) VALUES ({values});",

    # --- Fast Clear & DDL Table/Partition Operations ---
    "TRUNCATE TABLE {table};",
    "TRUNCATE {table};",
    "ALTER TABLE {table} TRUNCATE PARTITION {partition_name};",
    "ALTER TABLE {table} DROP PARTITION {partition_name};",

    # --- Analytical / Warehouse Overwrites (CTAS & Overwrite) ---
    "INSERT OVERWRITE TABLE {table} SELECT * FROM {staging_table};",
    "CREATE OR REPLACE TABLE {table} AS SELECT * FROM {staging_table} WHERE {condition};",

    # --- Columnar / Engine Specific Mutations (e.g., ClickHouse) ---
    "ALTER TABLE {table} DELETE WHERE {condition};",
    "DELETE FROM {table} IN PARTITION {partition_name} WHERE {condition};",
    "ALTER TABLE {table} MODIFY TTL {timestamp_column} + INTERVAL {interval} DELETE;",

    # --- Schema and Database Deletions ---
    "DROP TABLE {table};",
    "DROP TABLE IF EXISTS {table};",
    "DROP TABLE {table} CASCADE;",
    "DROP MATERIALIZED VIEW {view_name};",
    "DROP DATABASE {database_name};",
    "DROP SCHEMA {schema_name} CASCADE;",

    # --- Unconditional & Destructive Updates ---
    "UPDATE {table} SET {column} = {value};",
    "UPDATE {table} SET {column} = NULL;", 
    "UPDATE {table} SET {column} = (SELECT {other_column} FROM {other_table} WHERE {condition});",
    "UPDATE {table} SET {column} = DEFAULT;",

    # --- Column and Constraint Removals ---
    "ALTER TABLE {table} DROP COLUMN {column};",
    "ALTER TABLE {table} DROP CONSTRAINT {constraint_name};",
    "ALTER TABLE {table} DROP PRIMARY KEY;",
    "ALTER TABLE {table} DROP FOREIGN KEY {fk_name};",

    # --- Logic and Component Drops ---
    "DROP FUNCTION IF EXISTS {function_name};",
    "DROP PROCEDURE {procedure_name};",
    "DROP TRIGGER {trigger_name} ON {table};",
    "DROP INDEX {index_name};",
    "DROP TABLESPACE {tablespace_name} INCLUDING CONTENTS;",

    # --- Security and Permissions ---
    "GRANT ALL PRIVILEGES ON *.* TO {user};",
    "GRANT SUPERUSER TO {user};",
    "ALTER ROLE {role} WITH SUPERUSER;",
    "REVOKE ALL PRIVILEGES ON {database} FROM {user};",
    "DROP USER {user};",

    # --- Engine and OS Level Commands ---
    "EXEC master..xp_cmdshell '{os_command}';",
    "COPY {table} FROM PROGRAM '{os_command}';",
    "SELECT LOAD_FILE('{file_path}');",
    "SELECT {columns} INTO OUTFILE '{file_path}';",
    "SHUTDOWN;",
    "KILL {process_id};",
    
    # --- Index/Performance Sabotage ---
    "ALTER INDEX {index_name} DISABLE;",
    "ALTER INDEX ALL ON {table} DISABLE;"
]

