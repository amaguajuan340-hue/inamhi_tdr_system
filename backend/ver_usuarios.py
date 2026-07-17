import sqlite3

# Conectar
conn = sqlite3.connect('backend/inamhi_tdr.db')
cursor = conn.cursor()

# Listar todos los usuarios
cursor.execute("SELECT username, role FROM users")
usuarios = cursor.fetchall()

print("Usuarios encontrados en la base de datos:")
for u in usuarios:
    print(u)

conn.close()