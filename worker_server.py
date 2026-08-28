"""
worker_server.py
Servidor y Motor de Copy Trading 24/7 para Despliegue en la Nube (Render, Koyeb, Fly.io, Oracle Cloud).
Mantiene conexiones WebSockets continuas a Hyperliquid y expone un endpoint de salud en el puerto 8080.
"""

import os
import time
import json
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from multi_user_engine import MultiUserCopyEngine, load_users_db

PORT = int(os.environ.get("PORT", 8080))
engine_instance = None

class HealthCheckHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        users = load_users_db()
        unique_traders = engine_instance.get_all_unique_traders(users) if engine_instance else {}
        
        status_data = {
            "status": "ONLINE",
            "server": "Hyperliquid 24/7 WebSocket Copy Engine",
            "uptime": "Active",
            "registered_users": len(users),
            "monitored_traders": len(unique_traders),
            "traders_list": list(unique_traders.values()),
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(status_data, indent=2).encode("utf-8"))

    def log_message(self, format, *args):
        # Silenciar logs HTTP ruidosos
        pass

def run_http_server():
    server = HTTPServer(("0.0.0.0", PORT), HealthCheckHandler)
    print(f"🌐 Servidor de monitoreo Cloud HTTP activo en el puerto {PORT}")
    server.serve_forever()

def main():
    global engine_instance
    print("🚀 Iniciando Motor 24/7 de WebSockets de Hyperliquid...")
    
    # 1. Iniciar servidor HTTP en segundo plano para pasar los health-checks de Render/Koyeb
    http_thread = threading.Thread(target=run_http_server, daemon=True)
    http_thread.start()

    # 2. Iniciar motor de réplica por WebSockets
    engine_instance = MultiUserCopyEngine()
    engine_instance.sync_and_listen()

if __name__ == "__main__":
    main()
