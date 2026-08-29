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
    "DROP SCHEMA {schema_name} CASCADE;"
]

