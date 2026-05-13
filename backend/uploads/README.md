# Carpeta de archivos subidos (desarrollo local)

Esta carpeta es el destino de las evidencias cuando la variable de entorno
STORAGE_TYPE=local en el archivo .env.

## Reglas

- Solo se utiliza en desarrollo local.
- En produccion se debe usar STORAGE_TYPE=s3 y configurar las variables
  S3_BUCKET, S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY.
- El contenido de esta carpeta NO se versiona (excluido en .gitignore).
- El archivo .gitkeep solo existe para que Git registre la carpeta vacia.

## Limpieza

Si necesitas eliminar todos los archivos subidos localmente, puedes correr:

    Get-ChildItem .\backend\uploads -File -Recurse -Exclude README.md,.gitkeep | Remove-Item -Force