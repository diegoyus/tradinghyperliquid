"""
main.py
Panel Principal interactivo para el Sistema Integral de Copy Trading en Hyperliquid.
"""

import os
import sys
from find_traders import obtener_traders, filtrar_mejores_traders, mostrar_tabla
from inspect_trader import inspeccionar_trader
from backtest_trader import ejecutar_backtest
from paper_bot import MultiTraderCopyBot, PaperPortfolio, load_traders_config, save_traders_config
from telegram_notifier import is_telegram_configured, send_telegram_message

ENV_FILE = ".env"

def configurar_telegram():
    print("\n" + "=" * 65)
    print("  📲 CONFIGURACIÓN DE ALERTAS EN TIEMPO REAL POR TELEGRAM 📲")
    print("=" * 65)
    print("Para recibir alertas gratuitas en tu móvil:")
    print("1. Abre Telegram y busca a @BotFather para crear tu bot y obtener tu TOKEN.")
    print("2. Busca a @userinfobot en Telegram para ver tu CHAT ID personal.")
    print("-" * 65)
    
    token_actual = os.getenv("TELEGRAM_BOT_TOKEN", "")
    chat_actual = os.getenv("TELEGRAM_CHAT_ID", "")
    
    if token_actual and chat_actual:
        print(f"Estado actual: ✅ Ya está configurado.")
    else:
        print(f"Estado actual: ⚪ No configurado.")
    print("=" * 65)
    
    nuevo_token = input("Introduce tu TELEGRAM_BOT_TOKEN (o Enter para mantener actual): ").strip()
    nuevo_chat = input("Introduce tu TELEGRAM_CHAT_ID (o Enter para mantener actual): ").strip()
    
    token_final = nuevo_token if nuevo_token else token_actual
    chat_final = nuevo_chat if nuevo_chat else chat_actual
    
    if token_final and chat_final:
        with open(ENV_FILE, "w") as f:
            f.write(f"TELEGRAM_BOT_TOKEN={token_final}\n")
            f.write(f"TELEGRAM_CHAT_ID={chat_final}\n")
        
        os.environ["TELEGRAM_BOT_TOKEN"] = token_final
        os.environ["TELEGRAM_CHAT_ID"] = chat_final
        
        print("\n⏳ Enviando mensaje de prueba a tu Telegram...")
        # Recargar configuración en módulo
        import telegram_notifier
        telegram_notifier.TELEGRAM_BOT_TOKEN = token_final
        telegram_notifier.TELEGRAM_CHAT_ID = chat_final
        
        if send_telegram_message("🎉 <b>¡Enhorabuena!</b>\nTu bot de Copy Trading en Hyperliquid se ha conectado correctamente a tu móvil."):
            print("✅ ¡Mensaje de prueba recibido en tu móvil con éxito!")
        else:
            print("❌ No se pudo entregar el mensaje. Verifica que el bot esté iniciado (dale a /start en tu chat con el bot).")
    input("\nPresiona Enter para volver...")

def gestionar_traders():
    while True:
        traders = load_traders_config()
        print("\n" + "=" * 70)
        print("  ⚙️ GESTIÓN DE TRADERS Y ASIGNACIÓN DE CARTERA (%) ⚙️")
        print("=" * 70)
        
        total_alloc = sum(t.get("allocation_pct", 0) for t in traders)
        
        if not traders:
            print("  (Actualmente no tienes ningún trader en tu lista)")
        else:
            for i, t in enumerate(traders, 1):
                print(f"  {i}. {t['name']:<22} | Asignación: {t.get('allocation_pct', 0):>5.1f}% | Riesgo: {t.get('risk_multiplier', 1.0)}x | {t['address']}")
        
        print("-" * 70)
        print(f"  Total Cartera Asignada: {total_alloc:.1f}% / 100.0%")
        print("=" * 70)
        print("1. ➕ Añadir un nuevo trader")
        print("2. ➖ Eliminar un trader")
        print("3. ✏️ Modificar porcentaje de asignación (%)")
        print("4. ↩️ Volver al menú principal")
        
        opc = input("\nElige una opción (1-4): ").strip()
        
        if opc == "1":
            addr = input("\nDirección de la billetera (0x...): ").strip().lower()
            if not addr.startswith("0x") or len(addr) != 42:
                print("❌ Dirección inválida.")
                continue
            name = input("Alias o nombre para identificarlo (ej. Trader Alpha): ").strip() or addr[:8]
            try:
                alloc = float(input("Porcentaje de tu cartera a asignarle (ej. 30 para 30%): ").strip())
            except ValueError:
                alloc = 25.0
            
            traders.append({
                "name": name,
                "address": addr,
                "allocation_pct": alloc,
                "risk_multiplier": 1.0,
                "max_leverage": 10
            })
            save_traders_config(traders)
            print(f"✅ ¡Trader {name} añadido con éxito!")
            
        elif opc == "2":
            if not traders:
                print("No hay traders para eliminar.")
                continue
            idx = input(f"Número de trader a eliminar (1-{len(traders)}): ").strip()
            if idx.isdigit() and 1 <= int(idx) <= len(traders):
                eliminado = traders.pop(int(idx) - 1)
                save_traders_config(traders)
                print(f"🗑️ Trader {eliminado['name']} eliminado.")
                
        elif opc == "3":
            if not traders:
                print("No hay traders configurados.")
                continue
            idx = input(f"Número de trader a modificar (1-{len(traders)}): ").strip()
            if idx.isdigit() and 1 <= int(idx) <= len(traders):
                try:
                    nuevo_pct = float(input("Nuevo porcentaje (%) de cartera: ").strip())
                    traders[int(idx) - 1]["allocation_pct"] = nuevo_pct
                    save_traders_config(traders)
                    print("✅ Porcentaje actualizado.")
                except ValueError:
                    print("❌ Valor no válido.")
                    
        elif opc == "4":
            break

def menu_principal():
    while True:
        tg_badge = "🟢 Conectado" if is_telegram_configured() else "⚪ No configurado"
        print("\n" + "=" * 65)
        print("  ⚡ SISTEMA DE COPY TRADING EN HYPERLIQUID (PAPER TRADING) ⚡")
        print("=" * 65)
        print("1. 🏆 Buscar los mejores traders del Leaderboard")
        print("2. 🔍 Inspeccionar una billetera (posiciones abiertas y trades)")
        print("3. 🔬 Backtester Histórico (simular rentabilidad pasada)")
        print("4. ⚙️ Gestionar mi Cesta de Traders y Asignación de %")
        print(f"5. 📲 Configurar Alertas a Telegram [{tg_badge}]")
        print("6. 🚀 Iniciar Bot Multi-Trader en tiempo real")
        print("7. 💼 Ver estado de mi Cartera Virtual y Estadísticas")
        print("8. 🚪 Salir")
        print("=" * 65)
        
        opcion = input("Elige una opción (1-8): ").strip()
        
        if opcion == "1":
            print("\n⏳ Descargando y analizando datos del Leaderboard...")
            raw_data = obtener_traders()
            mejores = filtrar_mejores_traders(raw_data, min_balance=25_000.0, top_n=10)
            mostrar_tabla(mejores)
            input("Presiona Enter para volver al menú...")
            
        elif opcion == "2":
            direccion = input("\nPega la dirección de la billetera (0x...): ").strip()
            if not direccion.startswith("0x") or len(direccion) != 42:
                print("❌ Dirección no válida.")
            else:
                inspeccionar_trader(direccion)
            input("\nPresiona Enter para volver al menú...")
            
        elif opcion == "3":
            direccion = input("\nPega la dirección del trader a testear (Enter para usar 'Sticky'): ").strip()
            if not direccion:
                direccion = "0x613ead0ea5af374af0ccfc117ef116a8e8d133fe"
            elif not direccion.startswith("0x") or len(direccion) != 42:
                print("❌ Dirección no válida.")
                continue
            ejecutar_backtest(direccion)
            input("Presiona Enter para volver al menú...")

        elif opcion == "4":
            gestionar_traders()
            
        elif opcion == "5":
            configurar_telegram()
            
        elif opcion == "6":
            traders = load_traders_config()
            if not traders:
                print("⚠️ No tienes traders configurados. Ve a la opción 4 para añadir al menos uno.")
            else:
                bot = MultiTraderCopyBot(traders)
                bot.start()
            
        elif opcion == "7":
            portfolio = PaperPortfolio()
            portfolio.print_summary()
            input("Presiona Enter para volver al menú...")
            
        elif opcion == "8":
            print("\n¡Hasta pronto!")
            sys.exit(0)
        else:
            print("❌ Opción inválida. Introduce un número del 1 al 8.")

if __name__ == "__main__":
    menu_principal()
