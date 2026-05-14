const BOARD_SIZE = 8;
const COIN_VALUES = [3, 5, 10, 15, 20];
const RESERVED_SQUARES = [
    { x: 4, y: 7 },
    { x: 4, y: 0 },
    { x: 0, y: 4 },
    { x: 0, y: 3 }
];
const COIN_COLOR = {
    3: "#5a63ae",
    5: "#d65a57",
    10: "#e69a5d",
    15: "#1f9a75",
    20: "#cc4a82"
};
const PAPER_SIZES = {
    a4: { width: 210, height: 297, label: "A4" },
    letter: { width: 216, height: 279, label: "Carta" },
    a3: { width: 297, height: 420, label: "A3" }
};

let randomBoardSvg = "";
let exitIconHref = "./espejo.svg";

function createSvg(width, height, viewBox) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.setAttribute("viewBox", viewBox);
    return svg;
}

function addRect(parent, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, String(value)));
    parent.appendChild(el);
    return el;
}

function addCircle(parent, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, String(value)));
    parent.appendChild(el);
    return el;
}

function addText(parent, attrs, text) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "text");
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, String(value)));
    el.textContent = text;
    parent.appendChild(el);
    return el;
}

function addImage(parent, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "image");
    Object.entries(attrs).forEach(([key, value]) => {
        el.setAttribute(key, String(value));
    });
    parent.appendChild(el);
    return el;
}

function serializeSvg(svg) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(svg)}`;
}

function shuffle(list) {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

function isReserved(x, y) {
    return RESERVED_SQUARES.some((pos) => pos.x === x && pos.y === y);
}

function buildBalancedCoinPool() {
    const usableSquares = BOARD_SIZE * BOARD_SIZE - RESERVED_SQUARES.length;
    const perValue = Math.floor(usableSquares / COIN_VALUES.length);
    const pool = [];

    COIN_VALUES.forEach((value) => {
        for (let i = 0; i < perValue; i++) pool.push(value);
    });

    return shuffle(pool);
}

function drawCoin(g, cx, cy, r, value, rotate180 = false) {
    if (!rotate180) {
        addCircle(g, {
            cx,
            cy,
            r,
            fill: COIN_COLOR[value],
            stroke: "#ffffff",
            "stroke-width": 3
        });
        addText(
            g,
            {
                x: cx,
                y: cy + 8,
                "text-anchor": "middle",
                "font-size": 30,
                "font-family": "Trebuchet MS, Segoe UI, sans-serif",
                "font-weight": "800",
                fill: "#ffffff"
            },
            String(value)
        );
    } else {
        // Rotar 180° respecto al centro de la celda
        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.setAttribute("transform", `translate(${cx},${cy}) rotate(180) translate(${-cx},${-cy})`);
        addCircle(group, {
            cx,
            cy,
            r,
            fill: COIN_COLOR[value],
            stroke: "#ffffff",
            "stroke-width": 3
        });
        addText(
            group,
            {
                x: cx,
                y: cy + 8,
                "text-anchor": "middle",
                "font-size": 30,
                "font-family": "Trebuchet MS, Segoe UI, sans-serif",
                "font-weight": "800",
                fill: "#ffffff"
            },
            String(value)
        );
        g.appendChild(group);
    }
}

function drawKing(g, cx, cy, r, symbol, fill, textColor) {
    addCircle(g, {
        cx,
        cy,
        r,
        fill,
        stroke: textColor,
        "stroke-width": 4
    });

    addText(
        g,
        {
            x: cx,
            y: cy + 20,
            "text-anchor": "middle",
            "font-size": 64,
            "font-family": "Segoe UI Symbol, Noto Sans Symbols, serif",
            "font-weight": "700",
            fill: textColor
        },
        symbol
    );
}

function drawExitIcon(group, x, y, cell, rotate180 = false) {
    const size = cell * 0.7;
    const iconX = x * cell + (cell - size) / 2;
    const iconY = y * cell + (cell - size) / 2;
    if (!rotate180) {
        addImage(group, {
            x: iconX,
            y: iconY,
            width: size,
            height: size,
            preserveAspectRatio: "xMidYMid meet",
            href: exitIconHref
        });
    } else {
        // Rotar 180° y espejar horizontalmente respecto al centro de la celda
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute(
            "transform",
            `translate(${iconX + size / 2},${iconY + size / 2}) rotate(180) scale(-1,1) translate(${-size / 2},${-size / 2})`
        );
        addImage(g, {
            x: 0,
            y: 0,
            width: size,
            height: size,
            preserveAspectRatio: "xMidYMid meet",
            href: exitIconHref
        });
        group.appendChild(g);
    }
}

async function prepareExitIcon() {
    try {
        const response = await fetch("./espejo.svg", { cache: "force-cache" });
        if (!response.ok) return;
        const rawSvg = await response.text();
        exitIconHref = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(rawSvg)}`;
    } catch (error) {
        // Fallback to relative path if the icon cannot be inlined.
    }
}

function createBoardSvg(withCoins) {
    const margin = 70;
    const cell = 110;
    const boardPx = BOARD_SIZE * cell;
    const width = boardPx + margin * 2;
    const height = boardPx + margin * 2 + 65;

    const svg = createSvg("297mm", "297mm", `0 0 ${width} ${height}`);

    addRect(svg, { x: 0, y: 0, width, height, fill: "#f5f7f4" });
    addText(
        svg,
        {
            x: width / 2,
            y: 45,
            "text-anchor": "middle",
            "font-size": 30,
            "font-family": "Trebuchet MS, Segoe UI, sans-serif",
            "font-weight": "800",
            fill: "#253028"
        },
        withCoins
            ? "Ajedrez Espejo - Tablero con monedas aleatorias equilibradas"
            : "Ajedrez Espejo - Tablero limpio"
    );

    const boardGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    boardGroup.setAttribute("transform", `translate(${margin}, ${margin})`);
    svg.appendChild(boardGroup);

    // Dibuja la mitad inferior (filas 4-7) normal
    for (let y = 4; y < BOARD_SIZE; y++) {
        for (let x = 0; x < BOARD_SIZE; x++) {
            addRect(boardGroup, {
                x: x * cell,
                y: y * cell,
                width: cell,
                height: cell,
                fill: (x + y) % 2 === 0 ? "#edf0f3" : "#b8bdc4"
            });
        }
    }
    // Dibuja la mitad superior (filas 0-3) invertida verticalmente
    for (let y = 0; y < 4; y++) {
        for (let x = 0; x < BOARD_SIZE; x++) {
            addRect(boardGroup, {
                x: x * cell,
                y: (3 - y) * cell,
                width: cell,
                height: cell,
                fill: (x + y) % 2 === 0 ? "#edf0f3" : "#b8bdc4"
            });
        }
    }

    addRect(boardGroup, {
        x: 0,
        y: 0,
        width: boardPx,
        height: boardPx,
        fill: "none",
        stroke: "#2f3631",
        "stroke-width": 8
    });

    addRect(boardGroup, {
        x: 0,
        y: boardPx / 2 - 3,
        width: boardPx,
        height: 6,
        fill: "#aa304a"
    });

    addRect(boardGroup, {
        x: 0,
        y: 3 * cell,
        width: cell,
        height: cell,
        fill: "none",
        stroke: "#ffd766",
        "stroke-width": 6
    });
    addRect(boardGroup, {
        x: 0,
        y: 4 * cell,
        width: cell,
        height: cell,
        fill: "none",
        stroke: "#ffd766",
        "stroke-width": 6
    });

    // Salida inferior (normal)
    drawExitIcon(boardGroup, 0, 4, cell, false);
    // Salida superior (invertida y rotada)
    drawExitIcon(boardGroup, 0, 3, cell, true);

    if (withCoins) {
        const pool = buildBalancedCoinPool();
        let index = 0;
        // Mitad inferior (filas 4-7) normal
        for (let y = 4; y < BOARD_SIZE; y++) {
            for (let x = 0; x < BOARD_SIZE; x++) {
                if (isReserved(x, y)) continue;
                const value = pool[index++];
                drawCoin(boardGroup, x * cell + cell / 2, y * cell + cell / 2, 34, value, false);
            }
        }
        // Mitad superior (filas 0-3) invertida visualmente y rotada
        for (let y = 0; y < 4; y++) {
            for (let x = 0; x < BOARD_SIZE; x++) {
                // Chequear reserva en la posición de destino (x, 3-y)
                if (isReserved(x, 3 - y)) continue;
                const value = pool[index++];
                drawCoin(boardGroup, x * cell + cell / 2, (3 - y) * cell + cell / 2, 34, value, true);
            }
        }
    }

    addText(
        svg,
        {
            x: width / 2,
            y: height - 18,
            "text-anchor": "middle",
            "font-size": 19,
            "font-family": "Trebuchet MS, Segoe UI, sans-serif",
            fill: "#465349"
        },
        withCoins ? "60 monedas totales: 12 de cada valor" : "Formato vectorial listo para impresion"
    );

    return serializeSvg(svg);
}

function createCoinsSheetSvg() {
    const width = 1400;
    const height = 1000;
    const svg = createSvg("297mm", "210mm", `0 0 ${width} ${height}`);

    addRect(svg, { x: 0, y: 0, width, height, fill: "#fffdf8" });
    addText(
        svg,
        {
            x: width / 2,
            y: 60,
            "text-anchor": "middle",
            "font-size": 42,
            "font-family": "Trebuchet MS, Segoe UI, sans-serif",
            "font-weight": "800",
            fill: "#263328"
        },
        "Monedas Ajedrez Espejo (equilibradas)"
    );

    const perValue = 12;
    const cols = 6;
    const spacingX = 175;
    const spacingY = 150;
    const startX = 170;
    const startY = 150;

    COIN_VALUES.forEach((value, row) => {
        addText(
            svg,
            {
                x: 55,
                y: startY + row * spacingY + 12,
                "font-size": 34,
                "font-family": "Trebuchet MS, Segoe UI, sans-serif",
                "font-weight": "800",
                fill: "#333"
            },
            `${value} pts`
        );

        for (let i = 0; i < perValue; i++) {
            const col = i % cols;
            const line = Math.floor(i / cols);
            const cx = startX + col * spacingX;
            const cy = startY + row * spacingY + line * 64;
            drawCoin(svg, cx, cy, 48, value);
        }
    });

    addText(
        svg,
        {
            x: width / 2,
            y: height - 24,
            "text-anchor": "middle",
            "font-size": 28,
            "font-family": "Trebuchet MS, Segoe UI, sans-serif",
            fill: "#4a594e"
        },
        "Total: 60 monedas (12 por cada valor)"
    );

    return serializeSvg(svg);
}

function createKingsSheetSvg() {
    const width = 1200;
    const height = 800;
    const svg = createSvg("297mm", "210mm", `0 0 ${width} ${height}`);

    addRect(svg, { x: 0, y: 0, width, height, fill: "#fcfbf5" });
    addText(
        svg,
        {
            x: width / 2,
            y: 70,
            "text-anchor": "middle",
            "font-size": 46,
            "font-family": "Trebuchet MS, Segoe UI, sans-serif",
            "font-weight": "800",
            fill: "#27332a"
        },
        "Reyes - Ajedrez Espejo"
    );

    const slots = [
        { cx: 220, cy: 250, s: "♔", fill: "#ffffff", text: "#1f2d21" },
        { cx: 500, cy: 250, s: "♔", fill: "#ffffff", text: "#1f2d21" },
        { cx: 780, cy: 250, s: "♚", fill: "#23262b", text: "#f7faf9" },
        { cx: 1060, cy: 250, s: "♚", fill: "#23262b", text: "#f7faf9" },
        { cx: 220, cy: 560, s: "♔", fill: "#ffffff", text: "#1f2d21" },
        { cx: 500, cy: 560, s: "♔", fill: "#ffffff", text: "#1f2d21" },
        { cx: 780, cy: 560, s: "♚", fill: "#23262b", text: "#f7faf9" },
        { cx: 1060, cy: 560, s: "♚", fill: "#23262b", text: "#f7faf9" }
    ];

    slots.forEach((slot) => {
        drawKing(svg, slot.cx, slot.cy, 92, slot.s, slot.fill, slot.text);
    });

    addText(
        svg,
        {
            x: width / 2,
            y: height - 24,
            "text-anchor": "middle",
            "font-size": 28,
            "font-family": "Trebuchet MS, Segoe UI, sans-serif",
            fill: "#4a594e"
        },
        "Incluye 4 reyes blancos y 4 reyes negros"
    );

    return serializeSvg(svg);
}

function createFullSheetSvg() {
    const width = 1600;
    const height = 1100;
    const svg = createSvg("420mm", "297mm", `0 0 ${width} ${height}`);

    addRect(svg, { x: 0, y: 0, width, height, fill: "#fffdf7" });
    addText(
        svg,
        {
            x: width / 2,
            y: 56,
            "text-anchor": "middle",
            "font-size": 38,
            "font-family": "Trebuchet MS, Segoe UI, sans-serif",
            "font-weight": "800",
            fill: "#2e372f"
        },
        "Set completo imprimible - Ajedrez Espejo"
    );

    const coinStartX = 100;
    const coinStartY = 150;
    const rowGap = 165;
    const coinGap = 110;

    COIN_VALUES.forEach((value, row) => {
        addText(
            svg,
            {
                x: 42,
                y: coinStartY + row * rowGap + 10,
                "font-size": 28,
                "font-family": "Trebuchet MS, Segoe UI, sans-serif",
                "font-weight": "800",
                fill: "#333"
            },
            `${value} pts`
        );

        for (let i = 0; i < 12; i++) {
            const cx = coinStartX + i * coinGap;
            const cy = coinStartY + row * rowGap;
            drawCoin(svg, cx, cy, 38, value);
        }
    });

    drawKing(svg, 1430, 220, 84, "♔", "#ffffff", "#1f2d21");
    drawKing(svg, 1430, 430, 84, "♔", "#ffffff", "#1f2d21");
    drawKing(svg, 1430, 640, 84, "♚", "#23262b", "#f7faf9");
    drawKing(svg, 1430, 850, 84, "♚", "#23262b", "#f7faf9");

    addText(
        svg,
        {
            x: 1430,
            y: 980,
            "text-anchor": "middle",
            "font-size": 24,
            "font-family": "Trebuchet MS, Segoe UI, sans-serif",
            fill: "#475449"
        },
        "60 monedas + reyes"
    );

    return serializeSvg(svg);
}

function downloadTextFile(fileName, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function refreshRandomBoard() {
    randomBoardSvg = createBoardSvg(true);
    const preview = document.getElementById("preview");
    preview.innerHTML = randomBoardSvg;
}

function getPrintSettings() {
    const paper = document.getElementById("paper-size").value;
    const orientation = document.getElementById("paper-orientation").value;
    const marginMm = Number(document.getElementById("paper-margin").value);
    const base = PAPER_SIZES[paper] || PAPER_SIZES.a4;

    const pageWidthMm = orientation === "landscape" ? base.height : base.width;
    const pageHeightMm = orientation === "landscape" ? base.width : base.height;

    return {
        paper,
        orientation,
        marginMm,
        pageWidthMm,
        pageHeightMm,
        contentWidthMm: pageWidthMm - marginMm * 2,
        contentHeightMm: pageHeightMm - marginMm * 2
    };
}

function getSelectedPrintContent() {
    const target = document.getElementById("print-target").value;
    if (target === "board-clean") return createBoardSvg(false);
    if (target === "coins") return createCoinsSheetSvg();
    if (target === "kings") return createKingsSheetSvg();
    if (target === "full") return createFullSheetSvg();
    return randomBoardSvg;
}

function openPrintWindow(svgContent, settings) {
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Impresion Ajedrez Espejo</title>
<style>
    @page { size: ${settings.pageWidthMm}mm ${settings.pageHeightMm}mm; margin: ${settings.marginMm}mm; }
    body { margin: 0; display: grid; place-items: center; min-height: 100vh; background: #fff; }
    svg {
        width: min(${settings.contentWidthMm}mm, 100%);
        height: auto;
        max-height: ${settings.contentHeightMm}mm;
    }
</style>
</head>
<body>
${svgContent}
<script>window.onload = () => window.print();</script>
</body>
</html>`;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
}

function bindEvents() {
    document.getElementById("regen-board").addEventListener("click", refreshRandomBoard);

    document.getElementById("download-clean-board").addEventListener("click", () => {
        downloadTextFile("mirrorchess-board-clean.svg", createBoardSvg(false), "image/svg+xml;charset=utf-8");
    });

    document.getElementById("download-random-board").addEventListener("click", () => {
        downloadTextFile("mirrorchess-board-random-balanced.svg", randomBoardSvg, "image/svg+xml;charset=utf-8");
    });

    document.getElementById("download-coins-sheet").addEventListener("click", () => {
        downloadTextFile("mirrorchess-coins-balanced.svg", createCoinsSheetSvg(), "image/svg+xml;charset=utf-8");
    });

    document.getElementById("download-kings-sheet").addEventListener("click", () => {
        downloadTextFile("mirrorchess-kings.svg", createKingsSheetSvg(), "image/svg+xml;charset=utf-8");
    });

    document.getElementById("download-full-sheet").addEventListener("click", () => {
        downloadTextFile("mirrorchess-printable-set.svg", createFullSheetSvg(), "image/svg+xml;charset=utf-8");
    });

    document.getElementById("print-selected").addEventListener("click", () => {
        const settings = getPrintSettings();
        const content = getSelectedPrintContent();
        openPrintWindow(content, settings);
    });
}

async function initPrintables() {
    await prepareExitIcon();
    refreshRandomBoard();
    bindEvents();
}

initPrintables();
