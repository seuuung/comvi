const canvas = document.getElementById('kdtree-canvas');
const ctx = canvas.getContext('2d');

const treeCanvas = document.getElementById('tree-struct-canvas');
const ctxTree = treeCanvas.getContext('2d');

// Data
let points = [];
let tree = null;
let queryPoint = null;
let searchResult = null;

// 논리 공간 범위 (10x10)
const SPACE_MIN = 0;
const SPACE_MAX = 10;
const SPACE_RANGE = SPACE_MAX - SPACE_MIN;

// Settings
let useBBF = false;
let tryAllowed = 5;

// DOM Elements
const btnRandom = document.getElementById('btn-random-points');
const btnBuild = document.getElementById('btn-build-tree');
const btnClear = document.getElementById('btn-clear');
const searchOptionsPanel = document.getElementById('search-options-panel');
const toggleBBF = document.getElementById('toggle-bbf');
const tryAllowedContainer = document.getElementById('try-allowed-container');
const inputTryAllowed = document.getElementById('input-try-allowed');
const tryAllowedVal = document.getElementById('try-allowed-val');

const statNodeCount = document.getElementById('stat-node-count');
const statSearchVisited = document.getElementById('stat-search-visited');
const statLastAction = document.getElementById('stat-last-action');

// Colors
const COLOR_NODE = '#38bdf8';
const COLOR_X_LINE = 'rgba(239, 68, 68, 0.4)';
const COLOR_Y_LINE = 'rgba(34, 197, 94, 0.4)';
const COLOR_X_NODE_SOLID = '#ef4444'; // 트리용 불투명 빨강
const COLOR_Y_NODE_SOLID = '#22c55e'; // 트리용 불투명 초록
const COLOR_QUERY = '#fbbf24';
const COLOR_BEST = '#a855f7';
const COLOR_VISITED = '#22c55e'; // 밝은 녹색으로 가시성 강화
const COLOR_VISITED_LINE = '#4ade80'; // 연결선용 밝은 녹색
const COLOR_HOVER = '#f43f5e'; // 호버 강조 색상

let hoveredNode = null;

// 트리 캔버스 줌/팬 상태
let kdTreeZoom = 1;
let kdTreePanX = 0;
let kdTreePanY = 0;
let kdTreeDragging = false;
let kdTreeLastX = 0;
let kdTreeLastY = 0;
let kdFitScale = 1;
let kdFitCenterX = 0;
let kdFitCenterY = 0;

// 고정 레이아웃 상수
const KD_LAYOUT_X0 = 200;
const KD_LAYOUT_DY = 75;

function layoutKDTree(node, x, y, xOff) {
    if (!node) return;
    node.treeX = x; node.treeY = y;
    if (node.left) layoutKDTree(node.left, x - xOff, y + KD_LAYOUT_DY, xOff / 2);
    if (node.right) layoutKDTree(node.right, x + xOff, y + KD_LAYOUT_DY, xOff / 2);
}

function kdTreeBounds(node) {
    let mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity;
    (function t(n) { if (!n) return; mnX = Math.min(mnX, n.treeX); mxX = Math.max(mxX, n.treeX); mnY = Math.min(mnY, n.treeY); mxY = Math.max(mxY, n.treeY); t(n.left); t(n.right); })(node);
    return { minX: mnX, maxX: mxX, minY: mnY, maxY: mxY };
}

function kdScreenToWorld(sx, sy) {
    const cx = treeCanvas.width / 2, cy = treeCanvas.height / 2;
    return {
        x: (sx - cx - kdTreePanX) / (kdTreeZoom * kdFitScale) + kdFitCenterX,
        y: (sy - cy - kdTreePanY) / (kdTreeZoom * kdFitScale) + kdFitCenterY
    };
}

// ---- 논리 좌표 ↔ 캔버스 좌표 변환 ---- //
const PADDING = 30; // 캔버스 가장자리 여백 (축 라벨 공간)

function toCanvasX(logicalX) {
    return PADDING + ((logicalX - SPACE_MIN) / SPACE_RANGE) * (canvas.width - PADDING * 2);
}
function toCanvasY(logicalY) {
    return PADDING + ((logicalY - SPACE_MIN) / SPACE_RANGE) * (canvas.height - PADDING * 2);
}
function toLogicalX(canvasX) {
    return SPACE_MIN + ((canvasX - PADDING) / (canvas.width - PADDING * 2)) * SPACE_RANGE;
}
function toLogicalY(canvasY) {
    return SPACE_MIN + ((canvasY - PADDING) / (canvas.height - PADDING * 2)) * SPACE_RANGE;
}

function resizeCanvas() {
    // 캔버스를 0으로 리셋하여 부모 크기 측정에 영향을 주지 않도록 함
    canvas.width = 0;
    canvas.height = 0;
    treeCanvas.width = 0;
    treeCanvas.height = 0;

    const parent = canvas.parentElement;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    
    const treeParent = treeCanvas.parentElement;
    treeCanvas.width = treeParent.clientWidth;
    treeCanvas.height = treeParent.clientHeight;
    
    render();
}
window.addEventListener('resize', resizeCanvas);

function updateStats(action) {
    if (statNodeCount) statNodeCount.innerText = points.length;
    if (statLastAction) statLastAction.innerText = action;
    if (statSearchVisited) {
        statSearchVisited.innerText = searchResult ? searchResult.visitedNodes.length : '-';
    }
    
    // 시각적 업데이트 효과 (Flash)
    const kdStatusBar = document.getElementById('kd-status-bar');
    if (kdStatusBar) {
        kdStatusBar.style.backgroundColor = 'rgba(100, 255, 218, 0.2)';
        setTimeout(() => {
            kdStatusBar.style.backgroundColor = 'rgba(0,0,0,0.3)';
        }, 300);
    }
}

// ----------------- Rendering ----------------- //

// 축 그리드 및 라벨 렌더링
function drawGrid() {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = '11px "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let i = SPACE_MIN; i <= SPACE_MAX; i++) {
        const cx = toCanvasX(i);
        const cy = toCanvasY(i);

        // 세로 그리드선
        ctx.beginPath();
        ctx.moveTo(cx, toCanvasY(SPACE_MIN));
        ctx.lineTo(cx, toCanvasY(SPACE_MAX));
        ctx.stroke();

        // 가로 그리드선
        ctx.beginPath();
        ctx.moveTo(toCanvasX(SPACE_MIN), cy);
        ctx.lineTo(toCanvasX(SPACE_MAX), cy);
        ctx.stroke();

        // X축 라벨 (상단)
        ctx.textBaseline = 'bottom';
        ctx.fillText(i, cx, toCanvasY(SPACE_MIN) - 6);

        // Y축 라벨
        ctx.save();
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(i, toCanvasX(SPACE_MIN) - 6, cy);
        ctx.restore();
    }
    ctx.restore();
}

function drawTree(node) {
    if (!node) return;

    ctx.lineWidth = 1.5;
    if (node.axis === 0) { // Vertical split (x)
        ctx.strokeStyle = COLOR_X_LINE;
        ctx.beginPath();
        ctx.moveTo(toCanvasX(node.point.x), toCanvasY(node.bounds.minY));
        ctx.lineTo(toCanvasX(node.point.x), toCanvasY(node.bounds.maxY));
        ctx.stroke();
    } else { // Horizontal split (y)
        ctx.strokeStyle = COLOR_Y_LINE;
        ctx.beginPath();
        ctx.moveTo(toCanvasX(node.bounds.minX), toCanvasY(node.point.y));
        ctx.lineTo(toCanvasX(node.bounds.maxX), toCanvasY(node.point.y));
        ctx.stroke();
    }

    drawTree(node.left);
    drawTree(node.right);
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctxTree.clearRect(0, 0, treeCanvas.width, treeCanvas.height);

    // 그리드 먼저 그리기
    drawGrid();

    if (tree && tree.root) {
        drawTree(tree.root);
        // 트리 구조 렌더링 (auto-fit + 줌/팬)
        layoutKDTree(tree.root, 0, 30, KD_LAYOUT_X0);
        const b = kdTreeBounds(tree.root);
        const pad = 40;
        const tw = Math.max(b.maxX - b.minX + pad * 2, 1);
        const th = Math.max(b.maxY - b.minY + pad * 2, 1);
        kdFitScale = Math.min(treeCanvas.width / tw, treeCanvas.height / th);
        kdFitCenterX = (b.minX + b.maxX) / 2;
        kdFitCenterY = (b.minY + b.maxY) / 2;

        ctxTree.save();
        ctxTree.translate(treeCanvas.width / 2, treeCanvas.height / 2);
        ctxTree.translate(kdTreePanX, kdTreePanY);
        ctxTree.scale(kdTreeZoom * kdFitScale, kdTreeZoom * kdFitScale);
        ctxTree.translate(-kdFitCenterX, -kdFitCenterY);
        drawTreeStruct(tree.root);
        ctxTree.restore();
    }

    if (searchResult && searchResult.visitedNodes) {
        searchResult.visitedNodes.forEach((node, index) => {
            const cx = toCanvasX(node.point.x);
            const cy = toCanvasY(node.point.y);
            ctx.beginPath();
            ctx.arc(cx, cy, 8, 0, Math.PI * 2);
            ctx.fillStyle = COLOR_VISITED;
            ctx.fill();

            if (index > 0) {
                const prevNode = searchResult.visitedNodes[index - 1];
                ctx.beginPath();
                ctx.moveTo(toCanvasX(prevNode.point.x), toCanvasY(prevNode.point.y));
                ctx.lineTo(cx, cy);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.lineWidth = 3;
                ctx.stroke();
            }
        });
    }

    points.forEach(p => {
        const cx = toCanvasX(p.x);
        const cy = toCanvasY(p.y);
        ctx.beginPath();
        if (hoveredNode && hoveredNode.point === p) {
            ctx.arc(cx, cy, 8, 0, Math.PI * 2);
            ctx.fillStyle = COLOR_HOVER;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#fff';
            ctx.stroke();
        } else {
            ctx.arc(cx, cy, 4, 0, Math.PI * 2);
            ctx.fillStyle = COLOR_NODE;
            ctx.fill();
        }
    });

    if (queryPoint) {
        const qcx = toCanvasX(queryPoint.x);
        const qcy = toCanvasY(queryPoint.y);
        ctx.beginPath();
        ctx.arc(qcx, qcy, 6, 0, Math.PI * 2);
        ctx.fillStyle = COLOR_QUERY;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fff';
        ctx.stroke();

        // 쿼리 좌표 라벨 표시
        ctx.font = 'bold 12px "Noto Sans KR", sans-serif';
        ctx.fillStyle = COLOR_QUERY;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`(${Math.round(queryPoint.x)}, ${Math.round(queryPoint.y)})`, qcx + 10, qcy - 6);

        if (searchResult && searchResult.bestNode) {
            const best = searchResult.bestNode.point;
            const bcx = toCanvasX(best.x);
            const bcy = toCanvasY(best.y);
            ctx.beginPath();
            ctx.moveTo(qcx, qcy);
            ctx.lineTo(bcx, bcy);
            ctx.strokeStyle = COLOR_BEST;
            ctx.setLineDash([5, 5]);
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.beginPath();
            ctx.arc(bcx, bcy, 7, 0, Math.PI * 2);
            ctx.fillStyle = COLOR_BEST;
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.stroke();
        }
    }
}

function drawTreeStruct(node) {
    if (!node) return;
    const x = node.treeX, y = node.treeY;

    if (node.left) {
        ctxTree.beginPath();
        ctxTree.moveTo(x, y);
        ctxTree.lineTo(node.left.treeX, node.left.treeY);
        if (searchResult && searchResult.visitedNodes && searchResult.visitedNodes.includes(node.left)) {
            ctxTree.strokeStyle = COLOR_VISITED_LINE;
            ctxTree.lineWidth = 4;
        } else {
            ctxTree.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctxTree.lineWidth = 1;
        }
        ctxTree.stroke();
        drawTreeStruct(node.left);
    }

    if (node.right) {
        ctxTree.beginPath();
        ctxTree.moveTo(x, y);
        ctxTree.lineTo(node.right.treeX, node.right.treeY);
        if (searchResult && searchResult.visitedNodes && searchResult.visitedNodes.includes(node.right)) {
            ctxTree.strokeStyle = COLOR_VISITED_LINE;
            ctxTree.lineWidth = 4;
        } else {
            ctxTree.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctxTree.lineWidth = 1;
        }
        ctxTree.stroke();
        drawTreeStruct(node.right);
    }

    ctxTree.beginPath();
    ctxTree.arc(x, y, 30, 0, Math.PI * 2);
    if (hoveredNode === node) {
        ctxTree.fillStyle = COLOR_HOVER;
        ctxTree.strokeStyle = '#fff';
        ctxTree.lineWidth = 3;
    } else {
        ctxTree.fillStyle = node.axis === 0 ? COLOR_X_NODE_SOLID : COLOR_Y_NODE_SOLID;
        if (searchResult && searchResult.bestNode === node) {
            ctxTree.strokeStyle = COLOR_BEST;
            ctxTree.lineWidth = 5;
            // 보라색 글로우 효과로 가시성 강화
            ctxTree.shadowColor = COLOR_BEST;
            ctxTree.shadowBlur = 12;
        } else if (searchResult && searchResult.visitedNodes && searchResult.visitedNodes.includes(node)) {
            ctxTree.strokeStyle = COLOR_VISITED;
            ctxTree.lineWidth = 4;
        } else {
            ctxTree.strokeStyle = '#fff';
            ctxTree.lineWidth = 1.5;
        }
    }
    ctxTree.fill();
    ctxTree.stroke();
    // 글로우 효과 초기화 (다른 노드에 영향 방지)
    ctxTree.shadowColor = 'transparent';
    ctxTree.shadowBlur = 0;

    // 논리 좌표 정수 표시
    const dispX = Math.round(node.point.x);
    const dispY = Math.round(node.point.y);
    ctxTree.fillStyle = '#fff';
    ctxTree.font = 'bold 22px "Noto Sans KR", sans-serif';
    ctxTree.textAlign = 'center';
    ctxTree.textBaseline = 'middle';
    ctxTree.fillText(`${dispX},${dispY}`, x, y);
}

// ----------------- Interactions ----------------- //

// Hover 기능
function getKdHoveredNode(x, y, isTreeCanvas) {
    if (!tree || !tree.root) return null;
    let closest = null;
    let minDist = isTreeCanvas ? 16 : 10;
    
    function traverse(node) {
        if (!node) return;
        let nx, ny;
        if (isTreeCanvas) {
            nx = node.treeX;
            ny = node.treeY;
        } else {
            // 논리 좌표를 캔버스 좌표로 변환하여 비교
            nx = toCanvasX(node.point.x);
            ny = toCanvasY(node.point.y);
        }
        if (nx !== undefined && ny !== undefined) {
            const dx = nx - x;
            const dy = ny - y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < minDist) {
                minDist = dist;
                closest = node;
            }
        }
        traverse(node.left);
        traverse(node.right);
    }
    traverse(tree.root);
    return closest;
}

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    const node = getKdHoveredNode(x, y, false);
    if (hoveredNode !== node) {
        hoveredNode = node;
        render();
    }
});

canvas.addEventListener('mouseleave', () => {
    hoveredNode = null;
    render();
});

treeCanvas.addEventListener('mousemove', (e) => {
    // 드래그 처리
    if (kdTreeDragging) {
        kdTreePanX += e.clientX - kdTreeLastX;
        kdTreePanY += e.clientY - kdTreeLastY;
        kdTreeLastX = e.clientX;
        kdTreeLastY = e.clientY;
        render();
        return;
    }
    // 호버 처리 (줌/팬 보정)
    const rect = treeCanvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (treeCanvas.width / rect.width);
    const sy = (e.clientY - rect.top) * (treeCanvas.height / rect.height);
    const { x, y } = kdScreenToWorld(sx, sy);
    const node = getKdHoveredNode(x, y, true);
    if (hoveredNode !== node) {
        hoveredNode = node;
        render();
    }
});

treeCanvas.addEventListener('mouseleave', () => {
    hoveredNode = null;
    render();
});

canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    // 캔버스의 실제 표시 크기와 내부 해상도 사이의 스케일 비율 계산
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // 캔버스 내부 좌표 → 논리 좌표로 변환
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;
    const lx = Math.round(toLogicalX(canvasX));
    const ly = Math.round(toLogicalY(canvasY));

    if (!tree) {
        alert("먼저 [트리 구축] 버튼을 눌러주세요.");
        return;
    }
    queryPoint = { x: lx, y: ly };
    if (useBBF) {
        searchResult = tree.approxNearestNeighbor(queryPoint, tryAllowed);
        updateStats(`BBF 탐색 (Try: ${searchResult.triesUsed})`);
    } else {
        searchResult = tree.nearestNeighbor(queryPoint);
        updateStats('정확한 탐색');
    }
    render();
});

btnRandom.addEventListener('click', () => {
    const existing = new Set(points.map(p => `${p.x},${p.y}`));
    let added = 0;
    let attempts = 0;
    while (added < 10 && attempts < 200) {
        const x = Math.floor(Math.random() * (SPACE_MAX - 1)) + 1;
        const y = Math.floor(Math.random() * (SPACE_MAX - 1)) + 1;
        const key = `${x},${y}`;
        attempts++;
        if (!existing.has(key)) {
            existing.add(key);
            points.push({ x, y });
            added++;
        }
    }
    tree = null;
    searchResult = null;
    queryPoint = null;
    updateStats(`랜덤 점 ${added}개 추가`);
    render();
});

btnBuild.addEventListener('click', () => {
    if (points.length === 0) return;
    tree = new KDTree([...points], SPACE_MAX, SPACE_MAX);
    searchResult = null;
    queryPoint = null;
    updateStats('트리 구축됨');
    render();
});

btnClear.addEventListener('click', () => {
    points = [];
    tree = null;
    searchResult = null;
    queryPoint = null;
    updateStats('초기화');
    render();
});


toggleBBF.addEventListener('change', (e) => {
    useBBF = e.target.checked;
    tryAllowedContainer.style.display = useBBF ? 'flex' : 'none';
    if (queryPoint && tree) {
        if (useBBF) {
            searchResult = tree.approxNearestNeighbor(queryPoint, tryAllowed);
            updateStats(`BBF 탐색 (Try: ${searchResult.triesUsed})`);
        } else {
            searchResult = tree.nearestNeighbor(queryPoint);
            updateStats('정확한 탐색');
        }
        render();
    }
});

inputTryAllowed.addEventListener('input', (e) => {
    tryAllowed = parseInt(e.target.value);
    tryAllowedVal.innerText = tryAllowed;
    if (queryPoint && tree && useBBF) {
        searchResult = tree.approxNearestNeighbor(queryPoint, tryAllowed);
        updateStats(`BBF 탐색 (Try: ${searchResult.triesUsed})`);
        render();
    }
});

resizeCanvas();
updateStats('준비됨');

// KD 트리 캔버스 줌/팬 이벤트
treeCanvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    kdTreeZoom = Math.max(0.3, Math.min(5, kdTreeZoom * factor));
    render();
}, { passive: false });

treeCanvas.addEventListener('mousedown', (e) => {
    kdTreeDragging = true;
    kdTreeLastX = e.clientX;
    kdTreeLastY = e.clientY;
    e.preventDefault();
});

window.addEventListener('mouseup', () => {
    kdTreeDragging = false;
});

treeCanvas.addEventListener('dblclick', () => {
    kdTreeZoom = 1;
    kdTreePanX = 0;
    kdTreePanY = 0;
    render();
});
