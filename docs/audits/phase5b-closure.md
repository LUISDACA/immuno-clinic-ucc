# Cierre de Fase 5B

Fecha: 2026-11-07. **Estado vigente: FASE 5B = PARTIAL.** No se declara paridad total ni preparación de producción.

## Estado por grupo

| Grupo | Estado | Evidencia / motivo |
|---|---|---|
| R01 | DONE | Recuperación de administración con la cobertura funcional registrada. |
| R02 | PARTIAL | Formularios y sesión tienen pruebas de componente, transporte local y navegador; faltan pares visuales completos por pantalla/estado y validación física. |
| R03 | PARTIAL | Lista, detalle, esquema y catálogo tienen casos focales y E2E responsive; la matriz completa de estados/roles/temas/viewports no está demostrada. |
| R04 | PARTIAL | H02, C02 y A07 están DONE; C02 ahora también oculta la contraparte si falta `currentUserId` (25 pruebas focales). Faltan comparaciones integrales por pantalla/estado en S04/S06/S08/S10/S11–S16. |
| R05 | PARTIAL | POCO X4 Pro físico: smoke integration **1 PASS**; login comprobado a1.8× y corregido el recorte del botón; teclado virtual abierto. Escala restaurada a1.0×. AVD de Android Studio/API35 sin KVM: UI no responde, **No tests ran**. Habla/orden de foco TalkBack, zoom nativo separado, otras pantallas y VoiceOver/iOS siguen UNKNOWN. |
| R06 | DONE | Historial para `app_admin`, ocultar interlocutor no identificable y semestres Flutter 1–10 implementados y probados. |
| R07 | PARTIAL | Los gates automatizados locales pasaron; permanece pendiente la cobertura visual R02–R04, R05 físico y una revisión semántica exhaustiva del árbol acumulado. |

## Verificación ejecutada

- Backend/PostgreSQL completo: **393 PASS,24 SKIP**. Los gates omitidos por ser optativos se ejecutaron por separado.
- Migraciones PostgreSQL sintéticas: **3 PASS** en bases vacías; no se ejecutaron downgrades.
- E2E Chrome/Next/FastAPI/PostgreSQL sintético: **21 PASS**.
- Next con BFF/PostgreSQL: **584 PASS,0 SKIP** tras la regresión C02; lint, typecheck y build webpack **PASS**.
- Revalidación Next 2026-11-07: **584 PASS,0 SKIP**, lint/typecheck/build webpack **PASS**; runtime de producción loopback devolvió HTTP200 en `/login` y `/admin`. No se toma HTTP200 como autorización ni paridad visual.
- Flutter 3.41.6/Dart 3.11.4: revalidación analyze **PASS**, test **447 PASS**, formato Dart **PASS** (103 archivos,0 cambiados).
- Android físico POCO X4 Pro: smoke integration **1 PASS**; Flutter analyze y suite **447 PASS**. La captura a1.8× acredita el texto completo del botón. El build debug del código actual se compiló e instaló tras desbloquear el teléfono y habilitar “Instalar vía USB”; instalación y proceso confirmados por ADB. Escala restaurada a1.0×. No se usaron credenciales.
- Android Studio Emulator 37.2.13/API35, reintento 2026-11-07: AVD arrancado con `-accel off` porque el host no expone `/dev/kvm`; tras ~194s completó el arranque, pero el sistema mostró “System UI isn't responding”. Dos ejecuciones de Flutter integration quedaron en `Installing ...` y se cancelaron; **No tests ran** (una reportó ADB exit -2). No cuenta como PASS ni como fallo funcional de la app. El AVD se detuvo.
- Ruff check y format **PASS**; pruebas backend focales después del formato **15 PASS**.
- `git diff --check` **PASS**; barrido de whitespace **522 archivos de texto,0 hallazgos**; patrones de credenciales de alta confianza **522 archivos de texto,0 coincidencias**. Este barrido no sustituye una revisión forense del historial.

Los primeros intentos backend/Flutter bloqueados por, respectivamente, el prefijo protector de nombre de base y sockets loopback del sandbox no se cuentan como resultados. Las reejecuciones con base sintética permitida y acceso loopback pasaron. Las advertencias no bloqueantes fueron deprecaciones de SQLAlchemy/Firebase, configuración de scope de pytest-asyncio y configuración de Vitest/Vite.

## Pendientes que impiden DONE

1. Completar la matriz Flutter → Next de las22 pantallas incluidas, separando cada estado aplicable: datos, permisos, carga, vacío, error/retry, éxito, navegación/contexto, paginación, responsive, nombres/foco/teclado, tema claro/oscuro y expiración de sesión. N/A debe tener motivo y UNKNOWN evidencia faltante.
2. Obtener capturas pareadas y mediciones para las filas pendientes. El inventario actual tiene36 grupos de evidencia, varios con capturas de una sola plataforma o sin par visual completo; los E2E funcionales no reemplazan esas comparaciones.
3. Completar validación física y registro del resultado de TalkBack, probar ampliación nativa activada desde Ajustes y extender la revisión a las pantallas requeridas. La prueba actual demuestra arranque/login, reflow a1.8×, botón sin recorte y apertura de teclado en POCO; activar el flag de magnificación por ADB no produjo ampliación y se restauró a su valor original. El AVD de Android Studio no sirve en este host sin KVM y mostró una UI no respondiente. No se extrapolan esas pruebas a accesibilidad ni paridad física integral.
4. Completar la revisión semántica de los cambios acumulados antes de release. El árbol incluye muchos cambios de fases anteriores y centenares de evidencias visuales; la nueva captura física de este cierre se añadió al inventario. La revisión funcional de esos cambios históricos no se ha completado y no debe sustituirse por una lectura agregada del `git status`.

La siguiente validación debe usar solo datos sintéticos y reejecutar los gates afectados. Sin despliegue, datos institucionales ni cambios de reglas clínicas.

## Actualización física R05 — 2026-11-07

El teléfono POCO X4 Pro fue reconocido por ADB y Flutter. La prueba de integración anónima llegó al login (**1 PASS**) con el cálculo que reserva la altura del texto escalado más el padding vertical efectivo. La captura física muestra el label «Ingresar» completo a1.8×: [login con escala grande](../ui/evidence/phase5b/android-physical-login/login-button-font-1.8-fixed.png). El build del código actual se reconstruyó e instaló después de desbloquear el teléfono y habilitar “Instalar vía USB”; ADB confirmó el paquete instalado y su proceso. Escala del sistema confirmada en1.0×. El teclado virtual se abrió sin introducir texto. No se usaron cuentas ni datos clínicos. Se recomienda volver a desactivar “Instalar vía USB” cuando termine la revisión manual; no desinstala la aplicación.

La revalidación local pasó `flutter analyze --no-pub`, la suite Flutter completa (**447 PASS**) y `git diff --check` para los archivos tocados; el widget test cubre el texto a1.8× y que el label quede dentro de los límites del botón. El usuario confirma que la comprobación de TalkBack ya se realizó antes; el registro disponible no contiene el resultado hablado ni el orden observado, así que esos detalles siguen UNKNOWN y no se repite la interacción. Zoom nativo separado, las demás pantallas y VoiceOver/iOS tampoco están verificados.

Se instaló Android Emulator37.2.13/API35 y se creó un AVD aislado en el SDK local. Sin `/dev/kvm`, el AVD no completó el arranque; el smoke virtual se canceló a los127,2s con `No tests ran` y ADB exit-2. **No cuenta como PASS.** Se detuvo el proceso; el AVD queda preparado para un host con aceleración. El detalle está en [implementación](phase5b-implementation.md).

Incidente de instalación: por una firma distinta en la misma `applicationId`, Flutter desinstaló la app anterior e instaló el build de prueba. El posible efecto en sus datos locales es **UNKNOWN**. La integración posterior limpió su instalación al terminar; el build actualizado fue reinstalado por `flutter run` para la inspección física. No se usaron cuentas reales. No consta un rollback verificado de la instalación anterior.

**R05 = PARTIAL; R07 = PARTIAL; FASE 5B = PARTIAL.** La paridad completa R02–R04, TalkBack audible/orden de foco, zoom nativo, VoiceOver/iOS, revisión semántica exhaustiva y cobertura de todas las pantallas siguen pendientes. Los criterios de cierre no se relajan.

## Fuera del alcance de este cierre

UI-16/UI-17 continúan BLOCKED por alcance; T-02/T-03 y validación del almacenamiento real siguen PARTIAL fuera de Fase5B. No se hizo commit. Los cambios de Fase5B se documentan en [implementación](phase5b-implementation.md), [pendientes](phase5b-remaining-work.md), [plan](phase5b-plan.md) y [matriz de paridad](../ui/phase5b-parity-matrix.md).

## Actualización de evidencia R02/S01 — 2026-11-07

Se alineó la composición base del login Next con Flutter y se verificó en Chromium a393×873 junto con recuperación de contraseña. La revisión visual confirma la misma jerarquía y una tarjeta de tamaño comparable; las medidas objetivas disponibles son de Next:345×516px, radio24, campos/acción52px, sin desbordamiento. Next suite completa actual **582 PASS,3 SKIP**; lint, typecheck y build webpack PASS. Esta corrida no configuró PostgreSQL; los skips no se cuentan como ejecutados. La evidencia es sintética, sin credenciales ni mutaciones, y está en [matriz R02/S01](../ui/phase5b-parity-matrix.md#continuación--r02-s01-login-claro) y [detalle de implementación](phase5b-implementation.md#continuación--r02-composición-visual-del-login-s01-2026-11-07). La mejora cierra únicamente la composición base de S01; loading/error, otros viewports/temas, teclado/foco real y paridad de las demás pantallas quedan pendientes. Una captura local anterior mostró un mensaje de sesión vencida sin registrar el status HTTP ni el estado de sesión; causa **UNKNOWN**, no resuelta por el caso sintético503. **R02=PARTIAL, R03=PARTIAL, R04=PARTIAL, R05=PARTIAL, R07=PARTIAL; FASE5B=PARTIAL.** No hay cambio al estado de cierre.
