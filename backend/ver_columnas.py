import sqlite3
conn = sqlite3.connect('backend/inamhi_tdr.db')
cursor = conn.cursor()
cursor.execute("PRAGMA table_info(users);")
columnas = [col[1] for col in cursor.fetchall()]
print("Columnas encontradas en la tabla 'users':", columnas)
conn.close()
