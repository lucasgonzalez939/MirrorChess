# Ajedrez Espejo

Juego de tablero para **dos jugadores locales** en el mismo dispositivo, inspirado en el ajedrez pero con reglas propias basadas en el concepto de simetría espejo.

## Concepto

Dos reyes se mueven en lados opuestos de un tablero 8×8 lleno de monedas con valor. En cada turno, un jugador mueve libremente (**líder**) y el otro debe replicar ese mismo movimiento reflejado (**respondedor**). El objetivo es acumular puntos recogiendo monedas y llegar a la casilla de salida propia.

El papel de líder y respondedor se alterna en cada turno completo, por lo que ambos jugadores toman decisiones activas en todo momento.

## Reglas básicas

- El tablero está dividido por una línea de espejo central.
- El **rey Blanco** (♔) ocupa la mitad inferior; el **rey Negro** (♚) ocupa la mitad superior.
- El líder mueve su rey una casilla en cualquier dirección (horizontal, vertical o diagonal).
- El respondedor debe realizar el movimiento simétrico según el eje de espejo activo:
  - **Espejo horizontal** — se invierte la componente vertical del movimiento.
  - **Espejo vertical** — se invierte la componente horizontal del movimiento.
- Al pasar por una casilla con moneda, el rey la recoge y suma su valor al marcador del jugador.
- La partida termina cuando un rey alcanza su casilla de **SALIDA**, o cuando se cumple la condición especial del modo activo.
- **Gana quien tenga más puntos** al finalizar (salvo en el modo Meta de Puntos).

### Modo Normal — reglas adicionales

- Ningún rey puede cruzar la línea central al lado contrario.
- Si el líder tiene al menos un movimiento que captura una moneda, **está obligado a capturar**; no puede moverse a una casilla vacía.

## Modos de juego

| Modo | Descripción |
|------|-------------|
| **Normal** | Espejo horizontal fijo. Captura de moneda obligatoria. Sin cruzar la línea central. |
| **Espejos Aleatorios** | Las casillas de salida se colocan en posiciones espejo aleatorias al inicio de cada partida. |
| **Espejos Móviles** | Cada 2 turnos completos, las salidas se mueven a casillas ya visitadas por cada rey. |
| **Sprint 10** | La partida dura exactamente 10 turnos completos; gana quien tenga más puntos al terminar. |
| **Espejo Alterno** | El eje de espejo alterna entre horizontal y vertical al inicio de cada turno. El eje activo se muestra visualmente en el tablero. |
| **Meta de Puntos** | Se genera una meta de puntos aleatoria (30–70). Al llegar a la salida, gana quien tenga la puntuación **más cercana** a la meta, no quien tenga más. |

## Fichas y monedas

Los reyes se muestran como fichas circulares grandes con sus símbolos de ajedrez. La ficha activa pulsa con una animación dorada.

Las monedas tienen cinco valores distintos, cada uno con su propio color:

| Valor | Color |
|-------|-------|
| 3  | Azul |
| 5  | Rojo |
| 10 | Naranja |
| 15 | Verde |
| 20 | Rosa |

## Tecnología

- **Vanilla JS** — módulo ES único (`game.js`) sin frameworks ni dependencias externas.
- **HTML5 / CSS3** — tablero con CSS Grid, tokens con `aspect-ratio`, animaciones CSS.
- **PWA** — instalable en Android e iOS, funciona completamente sin conexión gracias al Service Worker.

## Estructura del proyecto

```
MirrorChess/
├── index.html      # Shell PWA: menú de modos y estructura del juego
├── game.js         # Motor de juego completo (lógica, estado, renderizado)
├── style.css       # Diseño visual completo
├── sw.js           # Service Worker (caché offline, estrategia network-first)
├── manifest.json   # Manifiesto PWA (nombre, icono, colores, orientación)
└── icon.svg        # Icono local de la aplicación (reyes + línea espejo)
```
