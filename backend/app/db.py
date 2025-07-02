from sqlmodel import create_engine

# —————— Configuración de la base de datos ——————
# Crea y configura el engine de SQLModel para SQLite,
# apuntando al archivo de base de datos en app/app.db.
# El parámetro echo=False desactiva la impresión de SQL en consola.
engine = create_engine("sqlite:///app/app.db", echo=False)
