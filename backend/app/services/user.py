from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user import UserCreate

def get_user_by_username(db: Session, username: str):
    # Busca un usuario específico por su nombre
    return db.query(User).filter(User.username == username).first()

def create_user(db: Session, user: UserCreate):
    # Crea un usuario nuevo en la base de datos
    # NOTA: En fases posteriores encriptaremos la contraseña por seguridad.
    db_user = User(
        username=user.username, 
        hashed_password=user.password, 
        role=user.role
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user