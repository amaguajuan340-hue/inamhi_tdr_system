import sqlite3

# Ruta a la base de datos
db_path = 'backend/inamhi_tdr.db'

# Conectar
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Actualizamos usando la columna correcta 'role'
cursor.execute("UPDATE users SET role='director' WHERE username='director2'")
conn.commit()

print('¡Éxito! Filas cambiadas:', cursor.rowcount)
conn.close()