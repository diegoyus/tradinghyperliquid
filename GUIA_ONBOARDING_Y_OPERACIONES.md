# 📘 GUÍA DE ONBOARDING, OPERACIONES Y GESTIÓN DEL BOT

Este documento detalla el funcionamiento integral de la plataforma de Copy Trading en Hyperliquid, los pasos para comenzar desde cero, la interpretación sencilla de las métricas forenses y cómo gestionar o reiniciar la cartera.

---

## 1. 🚀 Inicio Rápido: Pasos de Onboarding

### Paso 1: Creación de Cuenta y Saldo Limpio
* Todo nuevo usuario comienza con **$10,000 USD de saldo virtual limpio**.
* La cesta de copia empieza con **0 traders asignados** (100% efectivo en caja) para que cada usuario elija con total libertad a los traders que mejor se adapten a su perfil.

### Paso 2: Selección de Traders en el Hall de la Fama
* Accede a la pestaña **`Traders`** para ver el **`👑 Hall de la Fama (Top 5)`** y los traders aprobados por la auditoría cuantitativa.
* Cada tarjeta cuenta con etiquetas de estilo e insignias institucionales (`Élite 👑`, `Conservador 🛡️`, `Scalper ⚡`, `Swing Trader 🌊`).

### Paso 3: Vinculación Inteligente & Filtro de Monedas
Al pulsar **`+ Copiar a mi Cesta`**, el sistema te permite configurar:
* **🛡️ ¿Copiar Posiciones Abiertas?:**
  * **Solo Nuevas Órdenes (Recomendado):** El bot **no arrastra operaciones viejas**. Espera a la siguiente orden que abra el trader a partir de ese segundo exacto.
  * **Copiar Posiciones Abiertas:** Abre de inmediato las posiciones vivas en la proporción asignada.
* **🪙 Filtro de Criptomonedas por Trader:**
  * **Todas las monedas (Sin restricciones):** Copia cualquier activo operado.
  * **Solo Monedas Permitidas (Whitelist):** Por ejemplo, copiar únicamente operaciones en `BTC` y `ETH`.
  * **Bloquear Monedas Específicas (Blacklist):** Por ejemplo, excluir memecoins o tokens volátiles como `PUMP` o `DOGE`.

### Paso 4: Conectar Telegram y Elegir Modo de Ejecución
En la pestaña **`Ajustes`**:
1. Introduce tu **Telegram Chat ID** (obtenido a través de `@userinfobot`).
2. Elige tu modo de validación preferido:
   * **⚡ 100% Automático (Instantáneo):** Replica las órdenes en milisegundos sin intervención humana.
   * **📱 Modo Aprobación por Telegram (Validación Previa):** El bot te enviará un mensaje con botones `[✅ Aprobar]` y `[❌ Descartar]` antes de abrir cualquier posición.

---

## 2. ℹ️ Glosario de Métricas en Lenguaje Sencillo (Para No Financieros)

| Métrica | ¿Qué significa en lenguaje sencillo? | Ejemplo Práctico | Valor Ideal |
| :--- | :--- | :--- | :--- |
| **Win Rate Real** | El porcentaje de operaciones ganadoras. | 95% = Gana en 95 de cada 100 operaciones y solo pierde en 5. | $\ge 75\%$ |
| **Max Drawdown** | La peor caída que ha sufrido la cuenta desde su punto más alto. | -2% = En su peor racha histórica solo bajó un 2% antes de recuperarse. | $< 10\%$ (Cuanto más bajo, más seguro) |
| **Profit Factor** | Cuánto dinero gana por cada dólar que pierde. | 3.0x = Gana \$3.00 por cada \$1.00 de pérdida. | $\ge 1.5\text{x}$ |
| **Ratio de Sortino** | Mide la regularidad de las ganancias castigando solo las caídas malas. | Sortino 5.0 = Ganancias constantes sin sustos bruscos. | $\ge 2.0$ (Élite $\ge 5.0$) |
| **Ratio de Calmar** | Relación entre la ganancia anual y la peor caída histórica. | Calmar 10.0 = Gana un 50% anual arriesgando caídas de solo el 5%. | $\ge 2.5\text{x}$ |
| **Expectativa ($/trade)** | El beneficio medio matemático esperado en cada operación. | +\$150/trade = Cada orden que abre genera una media de \$150 de beneficio. | Positivo ($> \$0$) |
| **Saldo Real** | El capital en USD que el trader tiene depositado en Hyperliquid. | \$120,000 USD = Cuenta con capital real y seria gestión de riesgo. | $> \$10,000\text{ USD}$ |
| **Apalancamiento Real** | Veces que multiplica su dinero con respecto a su saldo. | 2.5x = Si tiene \$10,000, opera un volumen de \$25,000. | $\le 5.0\text{x}$ |

---

## 3. 📜 Historial de Operaciones y Auditoría (`/history`)

En la sección **`Historial`** puedes examinar cada operación en detalle:
* **Filtros Multicriterio:** Estado (abiertas/cerradas), resultado (ganadoras/perdedoras), activo (`BTC`, `ETH`, etc.), trader específico y dirección (`LONG`/`SHORT`).
* **Exportación CSV:** Descarga el historial filtrado en hoja de cálculo con un clic.

---

## 4. 👑 Cuadro de Mandos Superadmin (`/admin`)

La cuenta matriz **`diegoyusdiez@gmail.com`** cuenta con acceso exclusivo al panel de Superusuario:
* **Activar / Desactivar Usuarios:** Botón de un clic para habilitar o pausar la operativa de cualquier usuario.
* **Métricas Globales:** Control del Total de Usuarios, Capital Total Gestionado (AUM), PnL neto global acumulado y traders activos en copia.
* **Inspección Profunda de Carteras:** Permite auditar qué traders copia cada inversor, sus porcentajes de asignación, stop loss y filtros de monedas.
* **Modo Impersonar:** Permite al Superadmin ver la plataforma exactamente con la vista de cualquier usuario.
* **Reseteo de Cuentas:** Capacidad para resetear el saldo de cualquier inversor a \$10,000 USD limpios.

---

## 5. 📊 Interpretación de la Doble Curva de Capital (Dashboard)

* 🟢 **Línea Verde (Dinero Cerrado):** Muestra el dinero que ya se ha ganado y consolidado en caja (beneficios realizados libres de riesgo).
* 🟣 **Línea Morada (Valor Total con Flotante):** Muestra el patrimonio total en vivo incluyendo las operaciones que están abiertas en este momento en el mercado.

---

## 6. 🔄 Cómo Borrar y Reiniciar Todo a Cero

Si deseas volver a empezar tu cartera con los \$10,000 USD iniciales y limpiar el historial previo:
1. En el **Dashboard**, pulsa el botón **`🔄 Reiniciar ($10,000)`** en la esquina superior derecha.
2. Confirma la acción.
3. El sistema reseteará tu saldo a **\$10,000 USD limpios**, borrará las operaciones previas y ocultará cualquier posición anterior a ese segundo.

---

## 7. 🛠️ Ejecución del Censo Masivo en la Terminal

Para actualizar o re-auditar el censo de las 44.000+ cuentas en segundo plano:
```bash
cd "/Users/diegoyus/Proyectos antigravity/tradinghyperliquid" && python3 master_census_scanner.py
```
* **Opción `[1]`**: Reanuda el censo y continúa auditando cuentas pendientes.
* **Opción `[2]`**: Borra la base de datos previa y empieza un censo limpio desde cero.
* **Opción `[3]`**: Exporta la base de datos actual y la publica a Vercel con un solo `Enter`.
