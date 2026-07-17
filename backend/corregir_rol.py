import sqlite3

# Ruta a la base de datos
db_path = 'backend/inamhi_tdr.db'

# Conectar y actualizar
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Actualizamos la tabla 'users'
cursor.execute("UPDATE users SET rol='director' WHERE username='director2'")
conn.commit()

print('Filas cambiadas:', cursor.rowcount)
conn.close()