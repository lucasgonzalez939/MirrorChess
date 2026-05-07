const BOARD_SIZE = 8;
const COIN_VALUES = [3, 5, 10, 15, 20];

const INITIAL_STATE = {
    kingA: { x: 4, y: 7 },
    kingB: { x: 4, y: 0 },
    exitA: { x: 0, y: 4 },
    exitB: { x: 0, y: 3 }
};

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
    winnerText: ''
};

function resetState() {
    state.kingA = { ...INITIAL_STATE.kingA };
    state.kingB = { ...INITIAL_STATE.kingB };
    state.scoreA = 0;
    state.scoreB = 0;
    state.leader = 'A';
    state.phase = 'leader';
    state.pendingMove = null;
    state.isGameOver = false;
    state.winnerText = '';
    initGrid();
    render();
}

function initGrid() {
    state.grid = Array.from({ length: BOARD_SIZE }, () =>
        Array.from({ length: BOARD_SIZE }, () => COIN_VALUES[Math.floor(Math.random() * COIN_VALUES.length)])
    );

    state.grid[state.kingA.y][state.kingA.x] = 0;
    state.grid[state.kingB.y][state.kingB.x] = 0;
    state.grid[state.exitA.y][state.exitA.x] = 0;
    state.grid[state.exitB.y][state.exitB.x] = 0;
}

function getOtherPlayer(player) {
    return player === 'A' ? 'B' : 'A';
}

function playerName(player) {
    return player === 'A' ? 'Blancas' : 'Negras';
}

function getKing(player) {
    return player === 'A' ? state.kingA : state.kingB;
}

function setKing(player, nextPos) {
    if (player === 'A') state.kingA = nextPos;
    else state.kingB = nextPos;
}

function getExit(player) {
    return player === 'A' ? state.exitA : state.exitB;
}

function isSamePos(a, b) {
    return a.x === b.x && a.y === b.y;
}

function isPosValid(pos) {
    return pos.x >= 0 && pos.x < BOARD_SIZE && pos.y >= 0 && pos.y < BOARD_SIZE;
}

function isSingleKingStep(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    return Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx !== 0 || dy !== 0);
}

function mirrorVector(dx, dy) {
    return { dx, dy: -dy };
}

function toSquareLabel(pos) {
    const file = String.fromCharCode(97 + pos.x);
    const rank = BOARD_SIZE - pos.y;
    return `${file}${rank}`;
}

function coinClass(value) {
    return `coin-${value}`;
}

function collectCoin(player) {
    const king = getKing(player);
    const points = state.grid[king.y][king.x];
    if (player === 'A') state.scoreA += points;
    else state.scoreB += points;
    state.grid[king.y][king.x] = 0;
}

function evaluateWinner(reason) {
    state.isGameOver = true;
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

function evaluateAfterFullTurn() {
    const whiteReached = hasReachedExit('A');
    const blackReached = hasReachedExit('B');

    if (whiteReached || blackReached) {
        evaluateWinner('Se alcanzo un espejo. El ganador se decide solo por puntos.');
        return true;
    }

    return false;
}

function hasReachedExit(player) {
    return isSamePos(getKing(player), getExit(player));
}

function getExpectedResponderTarget() {
    if (!state.pendingMove) return null;
    const responder = state.pendingMove.responder;
    const responderKing = getKing(responder);
    const mirrored = mirrorVector(state.pendingMove.dx, state.pendingMove.dy);
    return { x: responderKing.x + mirrored.dx, y: responderKing.y + mirrored.dy };
}

function isLegalLeaderMove(player, target) {
    const leaderKing = getKing(player);
    const responder = getOtherPlayer(player);
    const responderKing = getKing(responder);

    if (!isSingleKingStep(leaderKing, target)) return false;
    if (!isPosValid(target)) return false;
    if (isSamePos(target, responderKing)) return false;

    const dx = target.x - leaderKing.x;
    const dy = target.y - leaderKing.y;
    const mirrored = mirrorVector(dx, dy);
    const responderTarget = { x: responderKing.x + mirrored.dx, y: responderKing.y + mirrored.dy };

    if (!isPosValid(responderTarget)) return false;
    if (isSamePos(responderTarget, target)) return false;

    return true;
}

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

function render() {
    const boardEl = document.getElementById('board');
    boardEl.innerHTML = '';

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

function handleMove(targetX, targetY) {
    if (state.isGameOver) return;

    const target = { x: targetX, y: targetY };

    if (state.phase === 'leader') {
        const leader = state.leader;
        if (!isLegalLeaderMove(leader, target)) return;

        const leaderKing = getKing(leader);
        const dx = target.x - leaderKing.x;
        const dy = target.y - leaderKing.y;
        const responder = getOtherPlayer(leader);

        setKing(leader, target);
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
    collectCoin(responder);

    if (evaluateAfterFullTurn()) {
        render();
        return;
    }

    state.leader = responder;
    state.phase = 'leader';
    state.pendingMove = null;

    if (!hasAnyLegalLeaderMove(state.leader)) {
        evaluateWinner(`${playerName(state.leader)} no tiene una apertura valida para espejar.`);
    }

    render();
}

function updateUI() {
    document.getElementById('scoreA').textContent = String(state.scoreA);
    document.getElementById('scoreB').textContent = String(state.scoreB);

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

document.getElementById('reset-btn').addEventListener('click', resetState);

resetState();
