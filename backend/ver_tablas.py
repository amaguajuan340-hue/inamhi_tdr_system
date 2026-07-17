import sqlite3
import os

# Buscamos la base de datos
db_path = 'backend/inamhi_tdr.db' if os.path.exists('backend/inamhi_tdr.db') else 'inamhi_tdr.db'

print(f"--- Buscando en: {db_path} ---")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tablas = cursor.fetchall()
print("Tablas encontradas:", tablas)
conn.close()