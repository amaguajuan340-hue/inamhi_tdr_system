import sqlite3

# Tus archivos de base de datos detectados
databases = ["inamhi_tdr.db", "tdr_system.db"]
tables = ["usuarios", "users"]
columns = ["rol", "role"]

print("--- Iniciando actualización de rol ---")

for db in databases:
    try:
        conn = sqlite3.connect(db)
        cursor = conn.cursor()
        for table in tables:
            for col in columns:
                try:
                    # Buscamos tanto 'director2' como 'directo2' por si acaso
                    cursor.execute(f"""
                        UPDATE {table} 
                        SET {col} = 'director' 
                        WHERE username IN ('director2', 'directo2')
                    """)
                    if cursor.rowcount > 0:
                        print(f"¡Éxito! Se actualizó el usuario en la BD '{db}', tabla '{table}', columna '{col}'.")
                        conn.commit()
                except sqlite3.OperationalError:
                    # Si la tabla o columna no existe en esta combinación, continúa buscando
                    continue
        conn.close()
    except Exception as e:
        print(f"Error al conectar a {db}: {e}")

print("--- Proceso terminado ---")
