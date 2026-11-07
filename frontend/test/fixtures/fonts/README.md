# Fuentes de referencia de tests

Inter Regular, Medium, SemiBold y Bold se usan únicamente en tests de pantalla.
No se añaden al pubspec ni cambian las fuentes de la aplicación.

Los bytes, tamaños y SHA-256 de `manifest.json` coinciden con los descriptores de
Inter de google_fonts 6.3.3, la dependencia actualmente fijada por pubspec.lock.
Se incluyen las URL de origen y la licencia OFL oficial de Google Fonts.

El test carga estos bytes locales y MaterialIcons desde el bundle del runner.
Desactiva la descarga en ejecución; usa el seam visibleForTesting assetManifest
del paquete para que AppTheme siga usando Inter real, sin Ahem ni sustitución.
Este seam se limita al test y se restaura al terminar. Una actualización futura
de google_fonts requiere revisar los descriptores y esta integración.

Desde frontend, con Flutter 3.41.6 y dependencias del lockfile:

```sh
flutter test --no-pub test/core/theme/phase5b_notifications_reference_test.dart
```

Para exportar PNG y mediciones, establecer PHASE5B_ARTIFACT_DIR en una carpeta
de evidencia. PHASE5B_CAPTURE_PREFIX controla el prefijo, por defecto after.
Las 16 muestras Flutter se comparan con matchesGoldenFile ANTES de exportar.
Se comprobó una repetición idéntica con este SDK/renderer. No son goldens
de todas las pantallas ni prueba de equivalencia de renderizadores con Chrome.
No actualizar imágenes automáticamente para ocultar un fallo de comportamiento.
