# Aula Lúmina

Plataforma educativa adaptable a móvil y escritorio, en español, para estudiantes y docentes. Incluye chat académico con OpenAI, perfiles, preferencias de aprendizaje, apuntes con guías de estudio, diagramas, herramientas multimedia y gestión de clases.

## Base de datos y cuentas persistentes

En desarrollo local, la aplicación sigue usando `data/aula-lumina.sqlite`. Al configurar `DATABASE_URL`, usa PostgreSQL administrado en Neon; crea automáticamente las tablas de cuentas, perfiles de matrícula, clases, listas de alumnos y sesiones. Las contraseñas permanecen protegidas con hash y las sesiones se guardan como huellas, con vigencia de 30 días.

Para conectar Render con Neon:

1. Crea un proyecto gratuito de PostgreSQL en Neon y copia su URL de conexión agrupada (pooled).
2. En Render, agrega `DATABASE_URL` en las variables de entorno del servicio. Trátala como secreto; no la publiques en GitHub ni en el navegador.
3. Guarda y despliega. La aplicación prepara el esquema de tablas automáticamente.

Neon publica actualmente 1 GB de base de datos por proyecto en su plan gratuito. El cómputo se duerme cuando queda inactivo y hay límites mensuales; revisa el panel de Neon para ver el consumo actual. Render Free borra los archivos locales cuando reinicia o despliega, y su propia base PostgreSQL gratuita expira a los 30 días, por eso la app no depende del disco local al configurar Neon.

La base SQLite local se conserva intacta. Para copiar sus cuentas, clases y sesiones a un proyecto Neon recién creado, configura `DATABASE_URL` localmente en `.env` y ejecuta `npm run migrate:neon`. El migrador es de solo lectura para SQLite y se detiene si detecta cuentas o clases en el destino, para evitar sobrescribir datos. Revisa que el proyecto Neon esté vacío antes de migrar.

## Clases, materias y matrículas

Los docentes pueden crear grupos por nivel, materia y tipo de clase, compartir un código de acceso y agregar matrículas en bloque. Si la persona ya tiene cuenta, queda vinculada de inmediato; si se registra después con esa matrícula, se enlaza al grupo. El docente ve únicamente sus propios grupos, los alumnos inscritos, su matrícula cuando existe y las preferencias de aprendizaje que el alumno completó.

Los estudiantes pueden unirse con el código de su docente. Para universidad la matrícula es obligatoria y se usa para enlazar los grupos. La lista de materias ofrece opciones comunes para Primaria, Secundaria, Preparatoria, Universidad y Posgrado; el docente también puede escribir otra materia.

## Tareas y entregas

Cada docente puede publicar tareas para los grupos que administra, con instrucciones y fecha límite. Los alumnos inscritos pueden entregar o actualizar una respuesta escrita; las entregas tardías se identifican. El docente revisa las respuestas, asigna una calificación de 0 a 100 y deja comentarios. Solo el docente del grupo y el estudiante inscrito pueden consultar la información correspondiente. Las tablas de tareas y entregas se crean automáticamente en Neon o SQLite y se incluyen en la migración de la base local.

## Ejecutar localmente

Requiere Node.js 20 o posterior. En esta carpeta ejecuta `npm install`, copia `.env.example` a `.env`, agrega una clave de OpenAI válida en `OPENAI_API_KEY` y arranca con `npm start`; abre `http://localhost:3000`. Deja `DATABASE_URL` vacío para usar SQLite local.

## OpenAI, Gemini y Cloudflare

El chat y las respuestas de texto utilizan la Responses API de OpenAI desde el servidor y nunca entregan la clave al navegador. El modelo predeterminado es `gpt-6-luna`; puedes cambiarlo con `OPENAI_MODEL`.

Las imágenes se generan con Cloudflare Workers AI (modelo predeterminado `@cf/black-forest-labs/flux-1-schnell`) y el audio leído en voz alta con Gemini TTS (modelo predeterminado `gemini-3.8-flash-lite-tts`). Para activarlos, configura `MEDIA_ENABLED=true`, `GEMINI_API_KEY`, `CLOUDFLARE_ACCOUNT_ID` y `CLOUDFLARE_API_TOKEN` en Render. Las claves solo se usan en el servidor. Puedes cambiar `GEMINI_TTS_MODEL`, `GEMINI_TTS_VOICE` y `CLOUDFLARE_IMAGE_MODEL`. La variable anterior `OPENAI_MEDIA_ENABLED` sigue funcionando si ya está configurada.

Gemini TTS devuelve WAV; la aplicación informa el formato al reproductor. Las solicitudes de imágenes se limitan a 2048 caracteres por los requisitos de FLUX. Ambos proveedores tienen cuotas y pueden generar cargos o rechazar solicitudes al agotarse el límite. En el nivel gratuito de Gemini, Google puede usar las solicitudes y respuestas para mejorar productos; para trabajar con información escolar sensible, revisa las condiciones y la modalidad del proyecto antes de enviar datos personales o apuntes.

El botón de video prepara un guion, pero no genera un archivo de video. Para eso se necesita conectar un proveedor de video distinto y configurar su clave por separado.

## Instalar en distintos dispositivos

Aula Lúmina es una aplicación web progresiva (PWA), no una app nativa separada. Después de publicarla en un dominio con HTTPS, se puede usar en Windows, macOS, Linux, Android y iPhone/iPad desde un navegador moderno. En Android y escritorio se ofrece «Instalar app» cuando el navegador lo permite. En iPhone/iPad, abre el sitio publicado en Safari, toca Compartir → Añadir a pantalla de inicio → Añadir. Se incluyen iconos PNG y las áreas seguras para la barra de inicio del iPhone.
