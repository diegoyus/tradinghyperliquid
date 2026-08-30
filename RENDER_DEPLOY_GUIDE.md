# 🚀 Guía de Despliegue y Estabilidad en Render (Plan Gratis)

Para que tu bot de Copy Trading funcione 24/7 en el plan gratuito de Render, debes solucionar el problema del "Sleep Mode" (Render apaga la app tras 15 min de inactividad).

## 1. Cómo evitar que el bot se duerma (Keep-Alive)

Como el bot es un proceso de fondo (Background Worker) o un Servidor Web, Render necesita recibir tráfico HTTP para mantenerse despierto.

### Opción A: El "Ping" Externo (Recomendado)
1. Crea una cuenta gratuita en [Cron-job.org](https://cron-job.org/).
2. Crea un nuevo "Cronjob".
3. En la URL, pon la dirección de tu aplicación de Render (ej: `https://mi-bot-trading.onrender.com`).
4. Configura la ejecución cada **5 o 10 minutos**.
5. Esto enviará una solicitud HTTP constante que engañará a Render haciéndole creer que la app está activa.

### Opción B: Endpoint de Salud (Healthcheck)
Si tienes un servidor web corriendo (como `worker_server.py`), asegúrate de tener una ruta `/` que devuelva un `200 OK`.

## 2. Gestión de la Base de Datos SQLite en Render

**IMPORTANTE:** Render tiene un sistema de archivos **efímero**. Esto significa que cada vez que el bot se reinicie o despliegues código nuevo, el archivo `trading_bot.db` se borrará y volverás a empezar de cero.

### Soluciones:
- **Plan Pago (Disk)**: Render permite añadir un "Disk" persistente (montaje de volumen). Es la única forma de mantener SQLite en Render.
- **Alternativa Gratuita (External DB)**: Si quieres persistencia 100% gratuita y real, migra de SQLite a **Supabase** o **ElephantSQL** (PostgreSQL gratuito). Solo tendrías que cambiar la función `get_connection` en `database.py` para que use `psycopg2` en lugar de `sqlite3`.

## 3. Monitorización de Logs

El bot ahora escribe todos los eventos en `bot_engine.log`. En Render, puedes ver estos logs en tiempo real desde el Dashboard de Render $\rightarrow$ **Logs**.

Si ves errores de `Connection Reset` o `WebSocket Closed`, es normal en redes inestables; el bot está diseñado para intentar reconectar en el próximo ciclo de `sync_and_listen`.
