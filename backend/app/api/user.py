from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import Usuario
from app.core.security import obtener_contrasena_encriptada, verificar_contrasena, crear_token_acceso

router = APIRouter()

@router.post("/register")
def registrar_usuario(
    username: str = Body(...),
    nombre_completo: str = Body(...),
    password: str = Body(...),
    role: str = Body(...),  # Cambiado a 'role'
    db: Session = Depends(get_db)
):
    # 1. Verificar si el usuario existe
    usuario_existente = db.query(Usuario).filter(Usuario.username == username.lower().strip()).first()
    if usuario_existente:
        raise HTTPException(status_code=400, detail="El nombre de usuario ya está registrado")
    
    # 2. Validar rol
    rol_limpio = role.lower().strip()
    if rol_limpio not in ["tecnico", "director"]:
        raise HTTPException(status_code=400, detail="Rol inválido. Debe ser 'tecnico' o 'director'")

    # 3. Guardar
    password_hash = obtener_contrasena_encriptada(password)
    nuevo_usuario = Usuario(
        username=username.lower().strip(),
        nombre_completo=nombre_completo,
        password_hash=password_hash,
        role=rol_limpio # Guardamos en la columna 'role'
    )
    
    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)
    return {"message": f"Usuario '{nuevo_usuario.username}' registrado con éxito como {nuevo_usuario.role}"}


@router.post("/login")
def login(
    username: str = Body(...),
    password: str = Body(...),
    db: Session = Depends(get_db)
):
    # 1. Buscar usuario
    usuario = db.query(Usuario).filter(Usuario.username == username.lower().strip()).first()
    if not usuario or not usuario.activo:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales incorrectas")
    
    # 2. Verificar contraseña
    if not verificar_contrasena(password, usuario.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales incorrectas")
    
    # 3. Empaquetar usando el atributo .role (que corresponde a la columna de la BD)
    token_payload = {
        "sub": usuario.username,
        "id": usuario.id,
        "role": usuario.role, # <-- Clave: estamos leyendo la columna correcta
        "nombre": usuario.nombre_completo
    }
    
    token_acceso = crear_token_acceso(data=token_payload)
    
    return {
        "access_token": token_acceso,
        "token_type": "bearer",
        "user": {
            "username": usuario.username,
            "nombre_completo": usuario.nombre_completo,
            "role": usuario.role # <-- Clave: enviamos 'role' al frontend
        }
    }