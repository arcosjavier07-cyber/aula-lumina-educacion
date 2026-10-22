# Aula Lúmina

Plataforma educativa adaptable a móvil y escritorio, en español, para estudiantes y docentes. Incluye chat de estudio con la API de OpenAI, acceso por correo, perfiles, diagnóstico académico de bienvenida, biblioteca de apuntes, cuestionarios, generador de diagramas y preferencias de tema.

## Ejecutar y publicar

Requiere Node.js 20 o posterior. En esta carpeta, instala dependencias con `npm install`, copia `.env.example` a `.env`, agrega una clave válida de OpenAI a `OPENAI_API_KEY` y arranca con `npm start`; abre `http://localhost:3000`.

La app se puede desplegar como contenedor Docker en un proveedor de hosting que permita volúmenes persistentes y HTTPS. Configura allí `OPENAI_API_KEY` como secreto y, opcionalmente, `OPENAI_MODEL`; el proveedor asigna `PORT`. Monta un volumen persistente en `/app/data` y establece `DATA_DIR=/app/data` para conservar las cuentas y la base SQLite después de reinicios.

## OpenAI y herramientas multimedia

El chat utiliza la Responses API de OpenAI desde el servidor y nunca entrega la clave al navegador. El modelo predeterminado es `gpt-6-luna`; puedes cambiarlo con `OPENAI_MODEL`.

La generación real de imágenes usa la Images API; la conversión de texto a voz usa la API de audio de OpenAI. Ambas se mantienen desactivadas de forma predeterminada. Para activarlas, configura `OPENAI_MEDIA_ENABLED=true` en el hosting y agrega una clave de API con acceso a esos modelos. Puedes cambiar los modelos con `OPENAI_IMAGE_MODEL` y `OPENAI_TTS_MODEL`. Cada cuenta tiene límites temporales para evitar solicitudes repetidas; las llamadas pueden generar cargos de API. La cuenta también puede requerir verificación para generación de imágenes.

La interfaz permite crear imágenes y audios. El botón de video prepara un guion, pero no genera el archivo: OpenAI retiró la Videos API y Sora 2 el 24 de septiembre de 2026. Para generar videos habrá que conectar un proveedor de video distinto y configurar su clave por separado.

## Alcance de la versión

Esta primera versión usa sesiones en memoria, una base SQLite y un diagnóstico general de muestra que se adapta al nivel indicado. Al reiniciarse el servidor, las personas deberán iniciar sesión de nuevo; sus cuentas se conservan en la base de datos. El hosting debe mantener una instancia viva y proveer un disco persistente. Antes de una implementación institucional conviene conectar un correo de restablecimiento de contraseña, respaldos de base de datos y un diagnóstico curricular por país y asignatura.

## Instalar en distintos dispositivos

Aula Lúmina es una aplicación web progresiva (PWA), no una app nativa separada. Después de publicarla en un dominio con HTTPS, se puede usar en Windows, macOS, Linux, Android y iPhone/iPad desde un navegador moderno. En Android y escritorio se ofrece «Instalar app» cuando el navegador lo permite. En iPhone/iPad, abre el sitio publicado en Safari, toca Compartir → Añadir a pantalla de inicio → Añadir. Se incluyen iconos PNG y las áreas seguras para la barra de inicio del iPhone. Después abre el icono añadido desde la pantalla de inicio. El modo sin conexión conserva la interfaz pública; el inicio de sesión, la base de datos y OpenAI requieren conexión.

Para verla localmente como sitio web, ejecuta `npm install` y `npm start`, y abre `http://localhost:3000`; evita abrir `index.html` directamente con `file://`, ya que los navegadores desactivan las funciones de instalación y caché para archivos locales.
