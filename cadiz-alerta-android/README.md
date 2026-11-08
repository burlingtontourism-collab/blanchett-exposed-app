# Cádiz Alerta — Android

Aplicación Android nativa (Kotlin + Jetpack Compose) para consultar previsiones meteorológicas en ocho sectores de la provincia de Cádiz.

## Primera entrega
- [x] Proyecto Android nativo.
- [x] Interfaz azul oscuro.
- [x] Consulta real de Open-Meteo para ocho puntos provinciales.
- [x] Actualización automática cada cinco minutos mientras la app está abierta.
- [x] Workflow de GitHub Actions para compilar un APK de depuración.
- [ ] Avisos oficiales AEMET en el móvil.
- [ ] Notificaciones push FCM con la app cerrada.
- [ ] Servicio externo programado cada cinco minutos.
- [ ] Pruebas en un Android físico.

## Compilar
El workflow **Build Cádiz Alerta Android** compila el APK en GitHub Actions y lo publica como artefacto descargable.

## Configuración pendiente
1. Crear proyecto Firebase y registrar el paquete `es.cadizalerta.app`.
2. Añadir `google-services.json` (no se incluye en el repositorio).
3. Guardar credenciales del servidor FCM como secretos, nunca en el código.
4. Solicitar API key de AEMET OpenData y guardarla como secreto del backend.
5. Desplegar el monitor programado para consultar avisos y enviar notificaciones.

La actualización cada cinco minutos de la pantalla funciona mientras la app está abierta. Android no garantiza ejecución periódica exacta en segundo plano; para alertas con la app cerrada se necesita un backend programado y FCM.

## Fuentes
- Open-Meteo: https://open-meteo.com/en/docs
- AEMET OpenData: https://opendata.aemet.es/
- Firebase Cloud Messaging: https://firebase.google.com/docs/cloud-messaging


Build trigger: workflow execution requested after initial scaffold commit.
