import sqlite3
import pandas as pd

db_path = 'database/database.db'  # путь к вашей базе

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Получим список всех таблиц
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = [row[0] for row in cursor.fetchall()]

for table in tables:
    print(f"Экспорт таблицы: {table}")
    df = pd.read_sql_query(f"SELECT * FROM {table}", conn)
    df.to_csv(f"{table}.csv", index=False, encoding='utf-8')
    print(f"Сохранено в файл: {table}.csv")

conn.close()
