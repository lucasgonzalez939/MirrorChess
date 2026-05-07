/**
 * @fileoverview Ajedrez Espejo — Motor de juego completo.
 *
 * Arquitectura:
 *   - Un único módulo ES sin dependencias externas.
 *   - Estado global mutable en `state`. Toda la lógica lo lee/escribe.
 *   - El DOM se reconstruye desde cero en cada llamada a `render()`.
 *   - El flujo de un turno completo es: fase "leader" → fase "responder" → evaluación.
 *
 * Coordenadas del tablero:
 *   x ∈ [0, 7]  →  columna de izquierda a derecha  (a–h en notación ajedrez)
 *   y ∈ [0, 7]  →  fila de arriba (y=0) a abajo (y=7)
 *
 * Jugadores:
 *   'A' = Blancas  (rey en y=7, mitad inferior del tablero)
 *   'B' = Negras   (rey en y=0, mitad superior del tablero)
 */

/** Número de filas y columnas del tablero. */
const BOARD_SIZE = 8;

/** Valores posibles de las monedas distribuidas aleatoriamente en el tablero. */
const COIN_VALUES = [3, 5, 10, 15, 20];

/**
 * Posiciones iniciales fijas usadas como referencia al reiniciar la partida.
 * Son restablecidas por `resetState()` en cada nueva partida.
 * @type {{ kingA: {x:number,y:number}, kingB: {x:number,y:number}, exitA: {x:number,y:number}, exitB: {x:number,y:number} }}
 */
const INITIAL_STATE = {
    kingA: { x: 4, y: 7 },
    kingB: { x: 4, y: 0 },
    exitA: { x: 0, y: 4 },
    exitB: { x: 0, y: 3 }
};

/**
 * Catálogo de todos los modos de juego disponibles.
 *
 * Cada entrada define las propiedades que activan o desactivan características:
 *   - `randomExits`      — las salidas se colocan en posiciones espejo aleatorias al inicio.
 *   - `movingMirrors`    — las salidas se reubican cada 2 turnos completos.
 *   - `alternatingMirror`— el eje de espejo alterna entre horizontal y vertical cada turno.
 *   - `sprintTurns`      — la partida termina tras N turnos completos; gana quien tenga más puntos.
 *   - `pointGoal`        — gana quien llegue a la salida con la puntuación más cercana a la meta aleatoria.
 *
 * @type {Object.<string, {
 *   id: string,
 *   name: string,
 *   description: string,
 *   ruleHint: string,
 *   randomExits: boolean,
 *   movingMirrors: boolean,
 *   alternatingMirror: boolean,
 *   sprintTurns: number|null,
 *   bonusCoins: boolean,
 *   pointGoal?: boolean
 * }>}
 */
const GAME_MODES = {
    normal: {
        id: 'normal',
        name: 'Normal',
        description: 'Dos reyes en mundos espejo: se alterna quien mueve libremente y el otro debe copiar en reflejo.',
        ruleHint: 'Normal: espejo horizontal fijo, no se cruza de lado y si puedes capturar moneda no puedes mover a vacia.',
        randomExits: false,
        movingMirrors: false,
        alternatingMirror: false,
        sprintTurns: null,
        bonusCoins: false
    },
    randomExits: {
        id: 'randomExits',
        name: 'Espejos Aleatorios',
        description: 'Las salidas cambian en cada partida en posiciones espejo aleatorias.',
        ruleHint: 'Salidas espejo aleatorias en cada reinicio.',
        randomExits: true,
        movingMirrors: false,
        alternatingMirror: false,
        sprintTurns: null,
        bonusCoins: false
    },
    movingMirrors: {
        id: 'movingMirrors',
        name: 'Espejos Moviles',
        description: 'Cada 2 turnos completos, las salidas se mueven a casillas ya visitadas por cada rey.',
        ruleHint: 'Espejos moviles: cada 2 turnos completos.',
        randomExits: false,
        movingMirrors: true,
        alternatingMirror: false,
        sprintTurns: null,
        bonusCoins: false
    },
    sprint: {
        id: 'sprint',
        name: 'Sprint 10',
        description: 'Nuevo modo: tras 10 turnos completos, gana quien tenga mas puntos.',
        ruleHint: 'Partida de 10 turnos completos.',
        randomExits: false,
        movingMirrors: false,
        alternatingMirror: false,
        sprintTurns: 10,
        bonusCoins: false
    },
    alternateMirror: {
        id: 'alternateMirror',
        name: 'Espejo Alterno',
        description: 'Nuevo modo: el espejo alterna entre horizontal y vertical en cada turno completo.',
        ruleHint: 'Espejo alterno: horizontal y vertical.',
        randomExits: false,
        movingMirrors: false,
        alternatingMirror: true,
        sprintTurns: null,
        bonusCoins: false,
        pointGoal: false
    },
    goalChase: {
        id: 'goalChase',
        name: 'Meta de Puntos',
        description: 'Se elige una meta de puntos al azar. Al llegar al espejo, gana quien este mas cerca de la meta, no quien tenga mas.',
        ruleHint: 'Llega al espejo con la puntuacion mas cercana a la meta.',
        randomExits: false,
        movingMirrors: false,
        alternatingMirror: false,
        sprintTurns: null,
        bonusCoins: false,
        pointGoal: true
    }
};

/**
 * Estado global de la partida en curso.
 *
 * Es el único objeto mutable compartido por toda la lógica.
 * Se restablece completamente en cada llamada a `resetState()`.
 *
 * @type {{
 *   kingA: {x:number,y:number},      — posición actual del rey Blanco
 *   kingB: {x:number,y:number},      — posición actual del rey Negro
 *   exitA: {x:number,y:number},      — posición de la salida de Blancas
 *   exitB: {x:number,y:number},      — posición de la salida de Negras
 *   grid: number[][],                — tablero 8×8; 0 = casilla vacía, >0 = valor de moneda
 *   scoreA: number,                  — puntos acumulados por Blancas
 *   scoreB: number,                  — puntos acumulados por Negras
 *   leader: 'A'|'B',                 — jugador que mueve libremente este turno
 *   phase: 'leader'|'responder',     — sub-fase dentro del turno actual
 *   pendingMove: {leader:'A'|'B', responder:'A'|'B', dx:number, dy:number}|null,
 *   isGameOver: boolean,
 *   winnerText: string,
 *   modeId: string,                  — modo activo (clave de GAME_MODES)
 *   selectedModeId: string,          — modo seleccionado en el menú (puede diferir del activo)
 *   completedTurns: number,          — número de turnos completos (líder+respuesta) transcurridos
 *   visitedA: Set<string>,           — claves "x,y" de casillas visitadas por Blancas
 *   visitedB: Set<string>,           — claves "x,y" de casillas visitadas por Negras
 *   gameStarted: boolean,            — false hasta que el usuario confirma el modo en el menú
 *   mirrorAxis: 'horizontal'|'vertical', — eje de espejo activo; cambia solo al inicio de cada turno
 *   goalTarget: number               — meta de puntos para el modo "Meta de Puntos" (0 en otros modos)
 * }}
 */
const state = {
    kingA: { ...INITIAL_STATE.kingA },
    kingB: { ...INITIAL_STATE.kingB },
    exitA: { ...INITIAL_STATE.exitA },
    exitB: { ...INITIAL_STATE.exitB },
    grid: [],
    scoreA: 0,
    scoreB: 0,
    leader: 'A',
    phase: 'leader',
    pendingMove: null,
    isGameOver: false,
    winnerText: '',
    modeId: 'normal',
    selectedModeId: 'normal',
    completedTurns: 0,
    visitedA: new Set(),
    visitedB: new Set(),
    gameStarted: false,
    mirrorAxis: 'horizontal',
    goalTarget: 0
};

/** Devuelve la definición del modo de juego actualmente en curso. */
function getMode() {
    return GAME_MODES[state.modeId];
}

/** Devuelve la definición del modo resaltado en el menú (puede no estar activo aún). */
function getSelectedMode() {
    return GAME_MODES[state.selectedModeId];
}

/**
 * Construye el menú de selección de modo y registra todos sus eventos.
 *
 * Crea un botón por cada entrada de GAME_MODES, actualiza la descripción
 * al seleccionar uno, y al pulsar "Iniciar Partida" activa el modo elegido,
 * oculta el menú y llama a `resetState()`.
 *
 * También conecta el botón "Cambiar Modo" del footer para reabrir el menú.
 * Debe llamarse una única vez al inicio (no recrea los listeners si se llama de nuevo).
 */
function setupModeMenu() {
    const list = document.getElementById('mode-list');
    const description = document.getElementById('mode-description');
    const startBtn = document.getElementById('start-btn');

    list.innerHTML = '';

    Object.values(GAME_MODES).forEach((mode) => {
        const option = document.createElement('button');
        option.type = 'button';
        option.dataset.modeId = mode.id;
        option.className = `mode-option ${mode.id === state.selectedModeId ? 'selected' : ''}`;
        option.textContent = mode.name;
        option.addEventListener('click', () => {
            state.selectedModeId = mode.id;
            refreshModeOptions();
            description.textContent = mode.description;
        });
        list.appendChild(option);
    });

    description.textContent = getSelectedMode().description;

    startBtn.addEventListener('click', () => {
        state.modeId = state.selectedModeId;
        state.gameStarted = true;
        hideMenu();
        resetState();
    });

    document.getElementById('menu-btn').addEventListener('click', () => {
        state.selectedModeId = state.modeId;
        refreshModeOptions();
        description.textContent = getSelectedMode().description;
        showMenu();
    });
}

/**
 * Actualiza la clase CSS `selected` en los botones del menú para reflejar
 * `state.selectedModeId` actual sin reconstruir toda la lista.
 */
function refreshModeOptions() {
    const options = document.querySelectorAll('.mode-option');
    options.forEach((option) => {
        option.classList.toggle('selected', option.dataset.modeId === state.selectedModeId);
    });
}

/** Muestra el overlay del menú de selección de modo. */
function showMenu() {
    document.getElementById('welcome-menu').classList.remove('hidden');
}

/** Oculta el overlay del menú de selección de modo. */
function hideMenu() {
    document.getElementById('welcome-menu').classList.add('hidden');
}

/**
 * Restablece todo el estado de la partida al valor inicial para el modo activo.
 *
 * Pasos:
 *   1. Restablece posiciones de reyes y salidas al valor de INITIAL_STATE.
 *   2. Pone a cero puntos, turno, fase y movimiento pendiente.
 *   3. Genera la meta de puntos si el modo es `pointGoal`.
 *   4. Aplica la ubicación de salidas según el modo (`applyModeExitPlacement`).
 *   5. Genera el tablero con monedas aleatorias (`initGrid`).
 *   6. Registra las posiciones iniciales de los reyes como visitadas.
 *   7. Llama a `render()` para reflejar el estado limpio en el DOM.
 */
function resetState() {
    state.kingA = { ...INITIAL_STATE.kingA };
    state.kingB = { ...INITIAL_STATE.kingB };
    state.exitA = { ...INITIAL_STATE.exitA };
    state.exitB = { ...INITIAL_STATE.exitB };
    state.scoreA = 0;
    state.scoreB = 0;
    state.leader = 'A';
    state.phase = 'leader';
    state.pendingMove = null;
    state.isGameOver = false;
    state.winnerText = '';
    state.completedTurns = 0;
    state.visitedA = new Set();
    state.visitedB = new Set();
    state.mirrorAxis = 'horizontal';
    state.goalTarget = GAME_MODES[state.modeId].pointGoal
        ? 30 + Math.floor(Math.random() * 41)
        : 0;

    applyModeExitPlacement();
    initGrid();

    addVisited('A', state.kingA);
    addVisited('B', state.kingB);

    render();
}

/**
 * Configura las posiciones de las salidas según el modo activo.
 *
 * - Modos sin `randomExits`: restaura las salidas al valor de `INITIAL_STATE`.
 * - Modos con `randomExits`: genera una pareja de salidas simétricas al azar
 *   mediante `getRandomMirroredExitPair()`.
 */
function applyModeExitPlacement() {
    const mode = getMode();

    if (!mode.randomExits) {
        state.exitA = { ...INITIAL_STATE.exitA };
        state.exitB = { ...INITIAL_STATE.exitB };
        return;
    }

    const pair = getRandomMirroredExitPair();
    state.exitA = pair.exitA;
    state.exitB = pair.exitB;
}

/**
 * Genera una pareja de salidas espejo aleatorias garantizando simetría horizontal.
 *
 * Elige una columna aleatoria y una fila en la mitad superior; la salida de
 * Negras va en esa fila (topY) y la de Blancas va en la fila simétrica (7−topY).
 * Reintenta hasta 100 veces para evitar solapar las posiciones iniciales de los reyes.
 * Si ningún intento es válido, devuelve las salidas por defecto de `INITIAL_STATE`.
 *
 * @returns {{ exitA: {x:number,y:number}, exitB: {x:number,y:number} }}
 */
function getRandomMirroredExitPair() {
    for (let attempt = 0; attempt < 100; attempt++) {
        const x = Math.floor(Math.random() * BOARD_SIZE);
        const topY = Math.floor(Math.random() * (BOARD_SIZE / 2));
        const bottomY = BOARD_SIZE - 1 - topY;

        const exitA = { x, y: bottomY };
        const exitB = { x, y: topY };

        if (
            !isSamePos(exitA, INITIAL_STATE.kingA) &&
            !isSamePos(exitB, INITIAL_STATE.kingB)
        ) {
            return { exitA, exitB };
        }
    }

    return {
        exitA: { ...INITIAL_STATE.exitA },
        exitB: { ...INITIAL_STATE.exitB }
    };
}

/**
 * Rellena `state.grid` con valores de moneda aleatorios de `COIN_VALUES`.
 *
 * Las casillas ocupadas por los reyes y las salidas se dejan en 0 (vacías)
 * para que no aparezca una moneda debajo de ellos al inicio de la partida.
 */
function initGrid() {
    state.grid = Array.from({ length: BOARD_SIZE }, () =>
        Array.from({ length: BOARD_SIZE }, () => COIN_VALUES[Math.floor(Math.random() * COIN_VALUES.length)])
    );

    state.grid[state.kingA.y][state.kingA.x] = 0;
    state.grid[state.kingB.y][state.kingB.x] = 0;
    state.grid[state.exitA.y][state.exitA.x] = 0;
    state.grid[state.exitB.y][state.exitB.x] = 0;
}

/** @param {'A'|'B'} player @returns {'A'|'B'} El jugador contrario. */
function getOtherPlayer(player) {
    return player === 'A' ? 'B' : 'A';
}

/** @param {'A'|'B'} player @returns {'Blancas'|'Negras'} Nombre legible del jugador. */
function playerName(player) {
    return player === 'A' ? 'Blancas' : 'Negras';
}

/** @param {'A'|'B'} player @returns {{x:number,y:number}} Posición actual del rey del jugador. */
function getKing(player) {
    return player === 'A' ? state.kingA : state.kingB;
}

/**
 * Actualiza la posición del rey en el estado.
 * @param {'A'|'B'} player
 * @param {{x:number,y:number}} nextPos
 */
function setKing(player, nextPos) {
    if (player === 'A') state.kingA = nextPos;
    else state.kingB = nextPos;
}

/** @param {'A'|'B'} player @returns {{x:number,y:number}} Posición de la salida del jugador. */
function getExit(player) {
    return player === 'A' ? state.exitA : state.exitB;
}

/**
 * Comprueba si dos posiciones son la misma casilla.
 * @param {{x:number,y:number}} a
 * @param {{x:number,y:number}} b
 */
function isSamePos(a, b) {
    return a.x === b.x && a.y === b.y;
}

/**
 * Comprueba si una posición está dentro de los límites del tablero.
 * @param {{x:number,y:number}} pos
 */
function isPosValid(pos) {
    return pos.x >= 0 && pos.x < BOARD_SIZE && pos.y >= 0 && pos.y < BOARD_SIZE;
}

/**
 * En el modo Normal, cada jugador debe permanecer en su mitad del tablero.
 * Blancas (A) ocupan las filas y ≥ 4 (mitad inferior).
 * Negras (B) ocupan las filas y < 4 (mitad superior).
 * @param {'A'|'B'} player
 * @param {{x:number,y:number}} pos
 * @returns {boolean}
 */
function isOnPlayerSide(player, pos) {
    if (player === 'A') return pos.y >= BOARD_SIZE / 2;
    return pos.y < BOARD_SIZE / 2;
}

/**
 * Verifica que el movimiento de `from` a `to` sea un paso de rey válido:
 * máximo 1 casilla en cualquier dirección (horizontal, vertical o diagonal),
 * sin quedarse en el mismo lugar.
 * @param {{x:number,y:number}} from
 * @param {{x:number,y:number}} to
 * @returns {boolean}
 */
function isSingleKingStep(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    return Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx !== 0 || dy !== 0);
}

/**
 * Devuelve el eje de espejo activo para el turno en curso.
 *
 * El valor se almacena en `state.mirrorAxis` y se actualiza solo al final
 * de cada turno completo (en `handleMove`), garantizando que líder y
 * respondedor siempre usen el mismo eje dentro del mismo turno.
 *
 * @returns {'horizontal'|'vertical'}
 */
function getMirrorType() {
    return state.mirrorAxis;
}

/**
 * Aplica la transformación de espejo a un vector de movimiento (dx, dy).
 *
 * - Espejo horizontal (línea central horizontal): invierte el componente Y.
 *   El rey de abajo se mueve en sentido vertical opuesto al de arriba.
 * - Espejo vertical (línea central vertical): invierte el componente X.
 *   El rey del lado derecho se mueve en sentido horizontal opuesto.
 *
 * @param {number} dx  Componente horizontal del movimiento del líder.
 * @param {number} dy  Componente vertical del movimiento del líder.
 * @returns {{dx:number, dy:number}} Vector transformado para el respondedor.
 */
function mirrorVector(dx, dy) {
    const mirrorType = getMirrorType();
    if (mirrorType === 'vertical') {
        return { dx: -dx, dy };
    }
    return { dx, dy: -dy };
}

/**
 * Convierte una posición de tablero a notación ajedrez (p. ej. {x:0,y:7} → "a1").
 * @param {{x:number,y:number}} pos
 * @returns {string}
 */
function toSquareLabel(pos) {
    const file = String.fromCharCode(97 + pos.x);
    const rank = BOARD_SIZE - pos.y;
    return `${file}${rank}`;
}

/**
 * Devuelve la clase CSS correspondiente al valor de una moneda.
 * @param {number} value  Uno de los valores de COIN_VALUES.
 * @returns {string}  P. ej. "coin-10".
 */
function coinClass(value) {
    return `coin-${value}`;
}

/**
 * Serializa una posición como clave de string para usarla en Sets y Maps.
 * @param {{x:number,y:number}} pos
 * @returns {string}  Formato "x,y".
 */
function posKey(pos) {
    return `${pos.x},${pos.y}`;
}

/**
 * Deserializa una clave generada por `posKey` de vuelta a un objeto posición.
 * @param {string} key
 * @returns {{x:number,y:number}}
 */
function keyToPos(key) {
    const [x, y] = key.split(',').map(Number);
    return { x, y };
}

/**
 * Registra una casilla como visitada por el jugador indicado.
 * Se usa para rastrear el historial de movimientos en el modo Espejos Móviles.
 * @param {'A'|'B'} player
 * @param {{x:number,y:number}} pos
 */
function addVisited(player, pos) {
    if (player === 'A') state.visitedA.add(posKey(pos));
    else state.visitedB.add(posKey(pos));
}

/**
 * Recoge la moneda de la casilla donde está el rey y suma su valor al marcador.
 * Deja la casilla en 0 para que no pueda recogerse dos veces.
 * @param {'A'|'B'} player
 */
function collectCoin(player) {
    const king = getKing(player);
    const points = state.grid[king.y][king.x];
    if (player === 'A') state.scoreA += points;
    else state.scoreB += points;
    state.grid[king.y][king.x] = 0;
}

/**
 * Declara el fin de la partida y determina el ganador.
 *
 * En el modo `pointGoal` gana quien esté más cerca de `state.goalTarget`
 * (menor distancia absoluta), en lugar de quien tenga más puntos.
 * En todos los demás modos gana quien acumule más puntos; si hay empate
 * se reporta como tal.
 *
 * @param {string} reason  Texto explicativo que se adjunta al mensaje de resultado.
 */
function evaluateWinner(reason) {
    state.isGameOver = true;

    if (getMode().pointGoal) {
        const goal = state.goalTarget;
        const distA = Math.abs(state.scoreA - goal);
        const distB = Math.abs(state.scoreB - goal);
        if (distA < distB) {
            state.winnerText = `Ganan Blancas (${state.scoreA} pts, a ${distA} de la meta ${goal}). ${reason}`;
        } else if (distB < distA) {
            state.winnerText = `Ganan Negras (${state.scoreB} pts, a ${distB} de la meta ${goal}). ${reason}`;
        } else {
            state.winnerText = `Empate: ambos a ${distA} de la meta ${goal}. ${reason}`;
        }
        return;
    }

    if (state.scoreA > state.scoreB) {
        state.winnerText = `Ganan Blancas (${state.scoreA} vs ${state.scoreB}). ${reason}`;
        return;
    }

    if (state.scoreB > state.scoreA) {
        state.winnerText = `Ganan Negras (${state.scoreB} vs ${state.scoreA}). ${reason}`;
        return;
    }

    state.winnerText = `Empate ${state.scoreA}-${state.scoreB}. ${reason}`;
}

/**
 * Comprueba las condiciones de fin de partida al término de cada turno completo.
 *
 * Condiciones evaluadas en orden:
 *   1. Algún rey alcanzó su salida → fin inmediato por puntos.
 *   2. Modo Sprint: se agotó el límite de turnos → fin por puntos.
 *
 * @returns {boolean}  `true` si la partida ha terminado, `false` si continúa.
 */
function evaluateAfterFullTurn() {
    const mode = getMode();
    const whiteReached = hasReachedExit('A');
    const blackReached = hasReachedExit('B');

    if (whiteReached || blackReached) {
        evaluateWinner('Se alcanzo un espejo. El ganador se decide solo por puntos.');
        return true;
    }

    if (mode.sprintTurns && state.completedTurns >= mode.sprintTurns) {
        evaluateWinner(`Se completo el limite de ${mode.sprintTurns} turnos.`);
        return true;
    }

    return false;
}

/**
 * Comprueba si el rey del jugador ocupa exactamente su casilla de salida.
 * @param {'A'|'B'} player
 * @returns {boolean}
 */
function hasReachedExit(player) {
    return isSamePos(getKing(player), getExit(player));
}

/**
 * Calcula la casilla exacta a la que debe moverse el respondedor.
 *
 * Aplica `mirrorVector` al vector (dx, dy) del movimiento del líder y lo
 * suma a la posición actual del respondedor. El respondedor no tiene elección:
 * solo puede (y debe) moverse a esta casilla.
 *
 * @returns {{x:number,y:number}|null}  Casilla destino, o `null` si no hay
 *   movimiento pendiente (se llama fuera de la fase "responder").
 */
function getExpectedResponderTarget() {
    if (!state.pendingMove) return null;
    const responder = state.pendingMove.responder;
    const responderKing = getKing(responder);
    const mirrored = mirrorVector(state.pendingMove.dx, state.pendingMove.dy);
    return { x: responderKing.x + mirrored.dx, y: responderKing.y + mirrored.dy };
}

/**
 * Validación base de legalidad para un movimiento del líder, sin aplicar
 * la regla de captura obligatoria del modo Normal.
 *
 * Comprueba en orden:
 *   1. El destino es un paso de rey válido (máximo 1 casilla).
 *   2. El destino está dentro del tablero.
 *   3. El destino no está ocupado por el rey contrario.
 *   4. (Solo modo Normal) El destino respeta la mitad del tablero del líder.
 *   5. El movimiento espejado para el respondedor también es válido:
 *      - cae dentro del tablero,
 *      - no coincide con la casilla a la que acaba de moverse el líder,
 *      - (Solo modo Normal) respeta la mitad del tablero del respondedor.
 *
 * @param {'A'|'B'} player  El jugador líder.
 * @param {{x:number,y:number}} target  Casilla de destino propuesta.
 * @returns {boolean}
 */
function isLegalLeaderMoveBase(player, target) {
    const leaderKing = getKing(player);
    const responder = getOtherPlayer(player);
    const responderKing = getKing(responder);

    if (!isSingleKingStep(leaderKing, target)) return false;
    if (!isPosValid(target)) return false;
    if (isSamePos(target, responderKing)) return false;

    const mode = getMode();
    if (mode.id === 'normal' && !isOnPlayerSide(player, target)) return false;

    const dx = target.x - leaderKing.x;
    const dy = target.y - leaderKing.y;
    const mirrored = mirrorVector(dx, dy);
    const responderTarget = { x: responderKing.x + mirrored.dx, y: responderKing.y + mirrored.dy };

    if (!isPosValid(responderTarget)) return false;
    if (isSamePos(responderTarget, target)) return false;
    if (mode.id === 'normal' && !isOnPlayerSide(responder, responderTarget)) return false;

    return true;
}

/**
 * Comprueba si el líder tiene al menos un movimiento legal que captura una moneda.
 *
 * Se usa en el modo Normal para implementar la regla de captura obligatoria:
 * si existe algún movimiento con moneda disponible, el líder no puede moverse
 * a una casilla vacía.
 *
 * @param {'A'|'B'} player
 * @returns {boolean}  `true` si hay al menos un movimiento que captura moneda.
 */
function hasCoinCaptureOptionForLeader(player) {
    const king = getKing(player);
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            const target = { x: king.x + dx, y: king.y + dy };
            if (!isLegalLeaderMoveBase(player, target)) continue;
            if (state.grid[target.y][target.x] > 0) return true;
        }
    }
    return false;
}

/**
 * Determina si un movimiento del líder es completamente legal en el modo activo.
 *
 * Aplica primero `isLegalLeaderMoveBase`. En el modo Normal añade además la
 * regla de captura obligatoria: si existe algún movimiento con moneda, el
 * movimiento a casilla vacía queda prohibido.
 *
 * @param {'A'|'B'} player
 * @param {{x:number,y:number}} target
 * @returns {boolean}
 */
function isLegalLeaderMove(player, target) {
    if (!isLegalLeaderMoveBase(player, target)) return false;

    const mode = getMode();
    if (mode.id !== 'normal') return true;

    if (!hasCoinCaptureOptionForLeader(player)) return true;
    return state.grid[target.y][target.x] > 0;
}

/**
 * Comprueba si el jugador tiene al menos un movimiento legal disponible como líder.
 *
 * Se invoca al inicio del turno de un nuevo líder para detectar situaciones
 * de bloqueo (sin apertura posible), lo que termina la partida.
 *
 * @param {'A'|'B'} player
 * @returns {boolean}
 */
function hasAnyLegalLeaderMove(player) {
    const king = getKing(player);
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            const target = { x: king.x + dx, y: king.y + dy };
            if (isLegalLeaderMove(player, target)) return true;
        }
    }
    return false;
}

/**
 * Devuelve un elemento aleatorio de un array, o `null` si está vacío.
 * @template T
 * @param {T[]} items
 * @returns {T|null}
 */
function getRandomFromArray(items) {
    if (!items.length) return null;
    return items[Math.floor(Math.random() * items.length)];
}

/**
 * En el modo Espejos Móviles, reubica las salidas cada 2 turnos completos.
 *
 * Elige al azar una casilla ya visitada por cada rey (excluyendo las
 * ocupadas actualmente) y la convierte en la nueva salida de ese jugador.
 * Limpia el valor de moneda de las nuevas casillas de salida para que no
 * aparezca una moneda sobre ellas.
 *
 * No hace nada si el modo no es `movingMirrors`, si aún no ha completado
 * ningún turno, o si el número de turnos no es par.
 */
function moveMirrorsIfNeeded() {
    const mode = getMode();
    if (!mode.movingMirrors || state.completedTurns === 0 || state.completedTurns % 2 !== 0) return;

    const candidatesA = [...state.visitedA]
        .map(keyToPos)
        .filter((pos) => !isSamePos(pos, state.kingA) && !isSamePos(pos, state.kingB));
    const candidatesB = [...state.visitedB]
        .map(keyToPos)
        .filter((pos) => !isSamePos(pos, state.kingA) && !isSamePos(pos, state.kingB));

    const nextA = getRandomFromArray(candidatesA);
    const nextB = getRandomFromArray(candidatesB);

    if (nextA) state.exitA = nextA;
    if (nextB) state.exitB = nextB;

    state.grid[state.exitA.y][state.exitA.x] = 0;
    state.grid[state.exitB.y][state.exitB.x] = 0;
}

/**
 * Reconstruye completamente el DOM del tablero y actualiza la interfaz.
 *
 * Por cada casilla (x, y) crea un elemento `<button class="square">` con:
 *   - Clases de color (`light`/`dark`), salida (`exit-a`/`exit-b`) y rey.
 *   - El token del rey si corresponde, con clase `active-king` si es su turno.
 *   - El token de moneda si la casilla tiene valor > 0.
 *   - Clase `legal-move` si el líder puede moverse ahí (fase "leader").
 *   - Clase `expected-response` si es el único destino válido del respondedor.
 * Al final llama a `updateUI()` para sincronizar marcadores y mensajes de texto.
 *
 * También establece `boardEl.dataset.mirrorAxis` para que el CSS pueda
 * dibujar la línea de espejo correcta (horizontal o vertical).
 */
function render() {
    const boardEl = document.getElementById('board');
    boardEl.innerHTML = '';
    boardEl.dataset.mirrorAxis = state.mirrorAxis;

    const expectedResponderTarget = state.phase === 'responder' ? getExpectedResponderTarget() : null;

    for (let y = 0; y < BOARD_SIZE; y++) {
        for (let x = 0; x < BOARD_SIZE; x++) {
            const square = document.createElement('button');
            square.type = 'button';
            square.className = `square ${(x + y) % 2 === 0 ? 'light' : 'dark'}`;

            if (x === state.exitA.x && y === state.exitA.y) square.classList.add('exit-a');
            if (x === state.exitB.x && y === state.exitB.y) square.classList.add('exit-b');

            if (x === state.kingA.x && y === state.kingA.y) {
                square.classList.add('king-a');
                const whiteIsActive =
                    !state.isGameOver && (
                        (state.phase === 'leader' && state.leader === 'A') ||
                        (state.phase === 'responder' && state.pendingMove && state.pendingMove.responder === 'A')
                    );
                if (whiteIsActive) square.classList.add('active-king');

                const king = document.createElement('span');
                king.className = 'king-mark king-a-mark';
                king.textContent = '♔';
                king.setAttribute('aria-label', 'Rey Blanco');
                square.appendChild(king);
            }

            if (x === state.kingB.x && y === state.kingB.y) {
                square.classList.add('king-b');
                const blackIsActive =
                    !state.isGameOver && (
                        (state.phase === 'leader' && state.leader === 'B') ||
                        (state.phase === 'responder' && state.pendingMove && state.pendingMove.responder === 'B')
                    );
                if (blackIsActive) square.classList.add('active-king');

                const king = document.createElement('span');
                king.className = 'king-mark king-b-mark';
                king.textContent = '♚';
                king.setAttribute('aria-label', 'Rey Negro');
                square.appendChild(king);
            }

            const value = state.grid[y][x];
            if (value > 0) {
                const coin = document.createElement('span');
                coin.className = `coin ${coinClass(value)}`;
                coin.textContent = value;
                square.appendChild(coin);
            }

            if (!state.isGameOver && state.phase === 'leader' && isLegalLeaderMove(state.leader, { x, y })) {
                square.classList.add('legal-move');
            }

            if (
                !state.isGameOver &&
                expectedResponderTarget &&
                expectedResponderTarget.x === x &&
                expectedResponderTarget.y === y
            ) {
                square.classList.add('expected-response');
            }

            square.addEventListener('click', () => handleMove(x, y));
            boardEl.appendChild(square);
        }
    }

    updateUI();
}

/**
 * Punto de entrada de interacción: gestiona el clic en una casilla del tablero.
 *
 * Flujo de dos fases por turno:
 *
 * **Fase "leader":**
 *   1. Valida que el movimiento sea legal (`isLegalLeaderMove`).
 *   2. Mueve el rey líder, registra la visita y recoge moneda.
 *   3. Almacena el vector (dx, dy) en `state.pendingMove` y pasa a la fase "responder".
 *
 * **Fase "responder":**
 *   1. Solo acepta el clic si coincide exactamente con `getExpectedResponderTarget()`.
 *   2. Mueve el rey respondedor, registra la visita y recoge moneda.
 *   3. Incrementa `completedTurns` y evalúa si la partida ha terminado.
 *   4. Mueve las salidas si aplica (`moveMirrorsIfNeeded`).
 *   5. Alterna el eje de espejo si el modo es `alternatingMirror`.
 *   6. Transfiere el rol de líder al respondedor anterior.
 *   7. Comprueba si el nuevo líder tiene alguna apertura válida; si no, fin.
 *
 * @param {number} targetX
 * @param {number} targetY
 */
function handleMove(targetX, targetY) {
    if (!state.gameStarted || state.isGameOver) return;

    const target = { x: targetX, y: targetY };

    if (state.phase === 'leader') {
        const leader = state.leader;
        if (!isLegalLeaderMove(leader, target)) return;

        const leaderKing = getKing(leader);
        const dx = target.x - leaderKing.x;
        const dy = target.y - leaderKing.y;
        const responder = getOtherPlayer(leader);

        setKing(leader, target);
        addVisited(leader, target);
        collectCoin(leader);

        state.pendingMove = { leader, responder, dx, dy };
        state.phase = 'responder';
        render();
        return;
    }

    const expected = getExpectedResponderTarget();
    if (!expected || !isSamePos(target, expected)) return;

    const responder = state.pendingMove.responder;
    setKing(responder, target);
    addVisited(responder, target);
    collectCoin(responder);

    state.completedTurns += 1;

    if (evaluateAfterFullTurn()) {
        render();
        return;
    }

    moveMirrorsIfNeeded();

    if (getMode().alternatingMirror) {
        state.mirrorAxis = state.mirrorAxis === 'horizontal' ? 'vertical' : 'horizontal';
    }

    state.leader = responder;
    state.phase = 'leader';
    state.pendingMove = null;

    if (!hasAnyLegalLeaderMove(state.leader)) {
        evaluateWinner(`${playerName(state.leader)} no tiene una apertura valida para espejar.`);
    }

    render();
}

/**
 * Sincroniza los elementos de interfaz fuera del tablero con el estado actual.
 *
 * Actualiza:
 *   - Marcadores de puntos de ambos jugadores.
 *   - Nombre del modo activo en el footer.
 *   - Pista de reglas (con sufijo del eje activo en Espejo Alterno y meta en Meta de Puntos).
 *   - Banner `#goal-display` (visible solo en modo Meta de Puntos, oculto tras fin de partida).
 *   - Mensaje de estado `#status-msg`: turno actual, instrucción al respondedor, o resultado.
 */
function updateUI() {
    document.getElementById('scoreA').textContent = String(state.scoreA);
    document.getElementById('scoreB').textContent = String(state.scoreB);
    document.getElementById('mode-name').textContent = `Modo: ${getMode().name}`;

    const mode = getMode();
    const mirrorType = getMirrorType();
    const axisLabel = mirrorType === 'horizontal' ? '↔ Horizontal' : '↕ Vertical';
    let hintSuffix = mode.alternatingMirror ? ` Espejo actual: ${axisLabel}.` : '';
    if (mode.pointGoal) hintSuffix += ` Meta: ${state.goalTarget} pts.`;
    document.getElementById('rule-hint').textContent = `${mode.ruleHint}${hintSuffix}`;

    const goalEl = document.getElementById('goal-display');
    if (goalEl) {
        if (mode.pointGoal && !state.isGameOver) {
            const distA = Math.abs(state.scoreA - state.goalTarget);
            const distB = Math.abs(state.scoreB - state.goalTarget);
            goalEl.textContent = `Meta: ${state.goalTarget} pts  |  ♔ a ${distA}  ♚ a ${distB}`;
            goalEl.hidden = false;
        } else {
            goalEl.hidden = true;
        }
    }

    const msg = document.getElementById('status-msg');
    if (state.isGameOver) {
        msg.textContent = `Fin de partida: ${state.winnerText}`;
        return;
    }

    if (state.phase === 'leader') {
        const responder = getOtherPlayer(state.leader);
        msg.textContent = `${playerName(state.leader)} lideran: mueve una casilla. ${playerName(responder)} deben espejar.`;
        return;
    }

    const expected = getExpectedResponderTarget();
    const targetText = expected ? toSquareLabel(expected) : '?';
    msg.textContent = `${playerName(state.pendingMove.responder)} deben espejar hacia ${targetText}.`;
}

document.getElementById('reset-btn').addEventListener('click', () => {
    if (!state.gameStarted) return;
    resetState();
});

setupModeMenu();
showMenu();
render();
