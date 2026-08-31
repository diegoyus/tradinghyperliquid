"""
main.py
Panel Principal interactivo para el Sistema Integral de Copy Trading en Hyperliquid.
Versión Refactorizada: Integrada con SQLite.
"""

import os
import sys
import database
from find_traders import obtener_traders, filtrar_mejores_traders, mostrar_tabla
from inspect_trader import inspeccionar_trader
from backtest_trader import ejecutar_backtest
from paper_bot import MultiTraderCopyBot, PaperPortfolio
from telegram_notifier import is_telegram_configured, send_telegram_message

ENV_FILE = ".env"

def configurar_telegram():
    print("\n" + "=" * 65)
    print("  📲 CONFIGURACIÓN DE ALERTAS EN TIEMPO REAL POR TELEGRAM 📲")
    print("=" * 65)

    token_actual = os.getenv("TELEGRAM_BOT_TOKEN", "")
    chat_actual = os.getenv("TELEGRAM_CHAT_ID", "")

    print(f"Estado actual: {'✅ Ya está configurado' if token_actual and chat_actual else '⚪ No configurado'}")
    print("=" * 65)

    nuevo_token = input("Introduce tu TELEGRAM_BOT_TOKEN (Enter para mantener): ").strip()
    nuevo_chat = input("Introduce tu TELEGRAM_CHAT_ID (Enter para mantener): ").strip()

    token_final = nuevo_token if nuevo_token else token_actual
    chat_final = nuevo_chat if nuevo_chat else chat_actual

    if token_final and chat_final:
        with open(ENV_FILE, "w") as f:
            f.write(f"TELEGRAM_BOT_TOKEN={token_final}\n")
            f.write(f"TELEGRAM_CHAT_ID={chat_final}\n")

        os.environ["TELEGRAM_BOT_TOKEN"] = token_final
        os.environ["TELEGRAM_CHAT_ID"] = chat_final

        import telegram_notifier
        telegram_notifier.TELEGRAM_BOT_TOKEN = token_final
        telegram_notifier.TELEGRAM_CHAT_ID = chat_final

        if send_telegram_message("🎉 <b>¡Enhorabuena!</b>\nTu bot se ha conectado correctamente."):
            print("✅ ¡Mensaje de prueba enviado!")
        else:
            print("❌ Error al enviar mensaje.")
    input("\nPresiona Enter para volver...")

def gestionar_traders():
    user_id = "default_user"
    while True:
        traders = database.get_user_traders(user_id)
        print("\n" + "=" * 70)
        print("  ⚙️ GESTIÓN DE TRADERS Y ASIGNACIÓN DE CARTERA (%) ⚙️")
        print("=" * 70)

        total_alloc = sum(t['allocation_pct'] for t in traders)

        if not traders:
            print("  (No tienes traders en tu lista)")
        else:
            for i, t in enumerate(traders, 1):
                print(f"  {i}. {t['name']:<22} | Asignación: {t['allocation_pct']:>5.1f}% | Riesgo: {t['risk_multiplier']}x | {t['trader_address']}")

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
            name = input("Alias o nombre (ej. Trader Alpha): ").strip() or addr[:8]
            try:
                alloc = float(input("Porcentaje de cartera (ej. 30): ").strip())
            except ValueError:
                alloc = 25.0

            database.upsert_user_trader(user_id, {
                "address": addr, "name": name, "allocation_pct": alloc,
                "risk_multiplier": 1.0, "max_leverage": 10
            })
            print(f"✅ ¡Trader {name} añadido!")

        elif opc == "2":
            if not traders:
                print("No hay traders.")
                continue
            idx = input(f"Número de trader a eliminar (1-{len(traders)}): ").strip()
            if idx.isdigit() and 1 <= int(idx) <= len(traders):
                addr = traders[int(idx)-1]['trader_address']
                database.delete_user_trader(user_id, addr)
                print("🗑️ Trader eliminado.")

        elif opc == "3":
            if not traders:
                print("No hay traders.")
                continue
            idx = input(f"Número de trader a modificar (1-{len(traders)}): ").strip()
            if idx.isdigit() and 1 <= int(idx) <= len(traders):
                try:
                    nuevo_pct = float(input("Nuevo porcentaje (%) : ").strip())
                    t = traders[int(idx)-1]
                    database.upsert_user_trader(user_id, {
                        "address": t['trader_address'], "name": t['name'],
                        "allocation_pct": nuevo_pct, "risk_multiplier": t['risk_multiplier'],
                        "max_leverage": t['max_leverage']
                    })
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
        print("2. 🔍 Inspeccionar una billetera")
        print("3. 🔬 Backtester Histórico")
        print("4. ⚙️ Gestionar mi Cesta de Traders")
        print(f"5. 📲 Configurar Alertas a Telegram [{tg_badge}]")
        print("6. 🚀 Iniciar Bot Multi-Trader en tiempo real")
        print("7. 💼 Ver estado de mi Cartera Virtual")
        print("8. 🚪 Salir")
        print("=" * 65)

        opcion = input("Elige una opción (1-8): ").strip()

        if opcion == "1":
            raw_data = obtener_traders()
            mejores = filtrar_mejores_traders(raw_data, min_balance=25_000.0, top_n=10)
            mostrar_tabla(mejores)
            input("Presiona Enter para volver...")
        elif opcion == "2":
            direccion = input("\nDirección (0x...): ").strip()
            if direccion.startswith("0x") and len(direccion) == 42:
                inspeccionar_trader(direccion)
            else:
                print("❌ Dirección no válida.")
            input("\nPresiona Enter para volver...")
        elif opcion == "3":
            direccion = input("\nDirección trader (Enter para 'Sticky'): ").strip() or "0x613ead0ea5af374af0ccfc117ef116a8e8d133fe"
            ejecutar_backtest(direccion)
            input("Presiona Enter para volver...")
        elif opcion == "4":
            gestionar_traders()
        elif opcion == "5":
            configurar_telegram()
        elif opcion == "6":
            traders = [dict(t) for t in database.get_user_traders("default_user")]
            if not traders:
                print("⚠️ Configura traders primero (Opción 4).")
            else:
                bot = MultiTraderCopyBot(traders)
                bot.start()
        elif opcion == "7":
            portfolio = PaperPortfolio("default_user")
            portfolio.print_summary()
            input("Presiona Enter para volver...")
        elif opcion == "8":
            sys.exit(0)
        else:
            print("❌ Opción inválida.")

if __name__ == "__main__":
    menu_principal()

# Deployment Trigger: Mon Aug 31 20:58:03 CEST 2026
