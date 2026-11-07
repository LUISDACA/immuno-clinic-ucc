# Ejecución aislada de carga

El plan usa `localhost:8000` por defecto. No ejecutarlo contra producción.
Crear cuentas sintéticas `admin.load@example.invalid` y
`student.load@example.invalid` en una base desechable; completar el cambio
obligatorio de contraseña antes de medir los endpoints autenticados.

Parámetros JMeter: `BASE_URL` (host sin esquema), `PORT`, `PROTOCOL`,
`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `STUDENT_EMAIL`, `STUDENT_PASSWORD`.
Las contraseñas no tienen valor predeterminado. Proporcionarlas mediante un
archivo `.properties` fuera del repositorio, con permisos restringidos,
usando `jmeter -q /ruta/privada/carga.properties -n -t ImmunoClinic_LoadTest.jmx`.
No incluir credenciales en argumentos de terminal, logs o artefactos.

Este cambio no demuestra capacidad ni modifica el modelo de carga. La
ejecución contra staging y sus métricas siguen pendientes. Las credenciales
retiradas del árbol pueden persistir en el historial Git: su vigencia es
UNKNOWN y la rotación de cuentas reales requiere el procedimiento humano.
