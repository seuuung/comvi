// DOM Elements for BST
const bstLineCanvas = document.getElementById('bst-numberline-canvas');
const ctxBstLine = bstLineCanvas.getContext('2d');

const bstTreeCanvas = document.getElementById('bst-tree-canvas');
const ctxBstTree = bstTreeCanvas.getContext('2d');

// Settings & State
let bstTree = new BST();
let bstValues = [];
let bstQuery = null;
let bstSearchResult = null;

// BST Stats Elements
const bstStatNodeCount = document.getElementById('bst-stat-node-count');
const bstStatSearchVisited = document.getElementById('bst-stat-search-visited');
const bstStatLastAction = document.getElementById('bst-stat-last-action');

function updateBSTStats(action) {
    if (bstStatNodeCount) bstStatNodeCount.innerText = bstValues.length;
    if (bstStatLastAction) bstStatLastAction.innerText = action;
    if (bstStatSearchVisited) {
        bstStatSearchVisited.innerText = bstSearchResult ? bstSearchResult.visitedNodes.length : '-';
    }
}

// Colors (재사용)
const BST_COLOR_NODE = '#38bdf8';
const BST_COLOR_LINE = 'rgba(255, 255, 255, 0.5)';
const BST_COLOR_QUERY = '#fbbf24';
const BST_COLOR_BEST = '#a855f7';
const BST_COLOR_VISITED = '#22c55e'; // 밝은 녹색으로 변경하여 가시성 강화
const BST_COLOR_VISITED_LINE = '#4ade80'; // 연결선용 더 밝은 녹색
const BST_COLOR_HIGHLIGHT = 'rgba(168, 85, 247, 0.3)'; // Search highlight area
const BST_COLOR_HOVER = '#f43f5e'; // 핑크/레드계열 강조

let bstHoveredNode = null;

// 트리 캔버스 줌/팬 상태
let bstTreeZoom = 1;
let bstTreePanX = 0;
let bstTreePanY = 0;
let bstTreeDragging = false;
let bstTreeLastX = 0;
let bstTreeLastY = 0;
let bstFitScale = 1;
let bstFitCenterX = 0;
let bstFitCenterY = 0;

// 고정 레이아웃 상수
const BST_LAYOUT_X0 = 200;
const BST_LAYOUT_DY = 55;

// 트리 레이아웃 사전 계산 (캔버스 크기와 무관한 고정 좌표)
function layoutBST(node, x, y, xOff) {
    if (!node) return;
    node.treeX = x; node.treeY = y;
    if (node.left) layoutBST(node.left, x - xOff, y + BST_LAYOUT_DY, xOff / 2);
    if (node.right) layoutBST(node.right, x + xOff, y + BST_LAYOUT_DY, xOff / 2);
}

// 트리 바운딩 박스
function bstTreeBounds(node) {
    let mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity;
    (function t(n) { if (!n) return; mnX = Math.min(mnX, n.treeX); mxX = Math.max(mxX, n.treeX); mnY = Math.min(mnY, n.treeY); mxY = Math.max(mxY, n.treeY); t(n.left); t(n.right); })(node);
    return { minX: mnX, maxX: mxX, minY: mnY, maxY: mxY };
}

// 스크린→월드 좌표 변환 (auto-fit + 줌/팬 보정)
function bstScreenToWorld(sx, sy) {
    const cx = bstTreeCanvas.width / 2, cy = bstTreeCanvas.height / 2;
    return {
        x: (sx - cx - bstTreePanX) / (bstTreeZoom * bstFitScale) + bstFitCenterX,
        y: (sy - cy - bstTreePanY) / (bstTreeZoom * bstFitScale) + bstFitCenterY
    };
}

function resizeBSTCanvas() {
    // 캔버스를 0으로 리셋하여 부모 크기 측정에 영향을 주지 않도록 함
    bstLineCanvas.width = 0;
    bstLineCanvas.height = 0;
    bstTreeCanvas.width = 0;
    bstTreeCanvas.height = 0;

    const lineParent = bstLineCanvas.parentElement;
    bstLineCanvas.width = lineParent.clientWidth;
    bstLineCanvas.height = lineParent.clientHeight;

    const treeParent = bstTreeCanvas.parentElement;
    bstTreeCanvas.width = treeParent.clientWidth;
    bstTreeCanvas.height = treeParent.clientHeight;
    
    renderBST();
}
window.addEventListener('resize', resizeBSTCanvas);

// --- Rendering ---

// 0~100 스케일을 캔버스 x좌표로 변환
function valToX(val, width) {
    return (val / 100) * width;
}

function renderBST() {
    ctxBstLine.clearRect(0, 0, bstLineCanvas.width, bstLineCanvas.height);
    ctxBstTree.clearRect(0, 0, bstTreeCanvas.width, bstTreeCanvas.height);

    const centerY = bstLineCanvas.height / 2;
    const width = bstLineCanvas.width;

    // 1. Number Line 렌더링
    // 기본 선
    ctxBstLine.beginPath();
    ctxBstLine.moveTo(0, centerY);
    ctxBstLine.lineTo(width, centerY);
    ctxBstLine.strokeStyle = BST_COLOR_LINE;
    ctxBstLine.lineWidth = 2;
    ctxBstLine.stroke();

    // 탐색 범위 하이라이트
    if (bstSearchResult && bstSearchResult.visitedNodes.length > 0) {
        const lastNode = bstSearchResult.visitedNodes[bstSearchResult.visitedNodes.length - 1];
        const minX = valToX(lastNode.bounds.min, width);
        const maxX = valToX(lastNode.bounds.max, width);
        
        ctxBstLine.fillStyle = BST_COLOR_HIGHLIGHT;
        ctxBstLine.fillRect(minX, centerY - 20, maxX - minX, 40);

        ctxBstLine.fillStyle = '#fff';
        ctxBstLine.font = '12px "Noto Sans KR"';
        ctxBstLine.textAlign = 'center';
        ctxBstLine.fillText(`탐색 공간: ${Math.round(lastNode.bounds.min)} ~ ${Math.round(lastNode.bounds.max)}`, width / 2, centerY - 30);
    }

    // 트리 노드를 모두 수집하여 그리기 (호버 동기화를 위해 노드 참조 필요)
    function getAllBstNodes(node, arr=[]) {
        if(!node) return arr;
        arr.push(node);
        getAllBstNodes(node.left, arr);
        getAllBstNodes(node.right, arr);
        return arr;
    }
    const allNodes = bstTree ? getAllBstNodes(bstTree.root) : [];

    // 값들(점) 그리기
    allNodes.forEach(node => {
        const x = valToX(node.value, width);
        node.lineX = x;
        node.lineY = centerY;

        ctxBstLine.beginPath();
        if (bstHoveredNode === node) {
            ctxBstLine.arc(x, centerY, 8, 0, Math.PI * 2);
            ctxBstLine.fillStyle = BST_COLOR_HOVER;
            ctxBstLine.fill();
            ctxBstLine.strokeStyle = '#fff';
            ctxBstLine.lineWidth = 2;
            ctxBstLine.stroke();
        } else {
            ctxBstLine.arc(x, centerY, 5, 0, Math.PI * 2);
            ctxBstLine.fillStyle = BST_COLOR_NODE;
            ctxBstLine.fill();
        }
        
        // 틱(Tick) 그리기
        ctxBstLine.beginPath();
        ctxBstLine.moveTo(x, centerY - 10);
        ctxBstLine.lineTo(x, centerY + 10);
        ctxBstLine.strokeStyle = 'rgba(255,255,255,0.3)';
        ctxBstLine.stroke();
    });

    // 쿼리(Query) 점 그리기
    if (bstQuery !== null) {
        const x = valToX(bstQuery, width);
        ctxBstLine.beginPath();
        ctxBstLine.arc(x, centerY, 7, 0, Math.PI * 2);
        ctxBstLine.fillStyle = BST_COLOR_QUERY;
        ctxBstLine.fill();
        ctxBstLine.lineWidth = 2;
        ctxBstLine.strokeStyle = '#fff';
        ctxBstLine.stroke();
    }

    // 2. Tree Structure 렌더링 (auto-fit + 줌/팬)
    if (bstTree && bstTree.root) {
        layoutBST(bstTree.root, 0, 30, BST_LAYOUT_X0);
        const b = bstTreeBounds(bstTree.root);
        const pad = 40;
        const tw = Math.max(b.maxX - b.minX + pad * 2, 1);
        const th = Math.max(b.maxY - b.minY + pad * 2, 1);
        bstFitScale = Math.min(bstTreeCanvas.width / tw, bstTreeCanvas.height / th);
        bstFitCenterX = (b.minX + b.maxX) / 2;
        bstFitCenterY = (b.minY + b.maxY) / 2;

        ctxBstTree.save();
        ctxBstTree.translate(bstTreeCanvas.width / 2, bstTreeCanvas.height / 2);
        ctxBstTree.translate(bstTreePanX, bstTreePanY);
        ctxBstTree.scale(bstTreeZoom * bstFitScale, bstTreeZoom * bstFitScale);
        ctxBstTree.translate(-bstFitCenterX, -bstFitCenterY);
        drawBSTStruct(bstTree.root);
        ctxBstTree.restore();
    }
}

function drawBSTStruct(node) {
    if (!node) return;
    const x = node.treeX, y = node.treeY;

    if (node.left) {
        ctxBstTree.beginPath();
        ctxBstTree.moveTo(x, y);
        ctxBstTree.lineTo(node.left.treeX, node.left.treeY);
        if (bstSearchResult && bstSearchResult.visitedNodes.includes(node.left)) {
            ctxBstTree.strokeStyle = BST_COLOR_VISITED_LINE;
            ctxBstTree.lineWidth = 4;
        } else {
            ctxBstTree.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctxBstTree.lineWidth = 1;
        }
        ctxBstTree.stroke();
        drawBSTStruct(node.left);
    }

    if (node.right) {
        ctxBstTree.beginPath();
        ctxBstTree.moveTo(x, y);
        ctxBstTree.lineTo(node.right.treeX, node.right.treeY);
        if (bstSearchResult && bstSearchResult.visitedNodes.includes(node.right)) {
            ctxBstTree.strokeStyle = BST_COLOR_VISITED_LINE;
            ctxBstTree.lineWidth = 4;
        } else {
            ctxBstTree.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctxBstTree.lineWidth = 1;
        }
        ctxBstTree.stroke();
        drawBSTStruct(node.right);
    }

    ctxBstTree.beginPath();
    ctxBstTree.arc(x, y, 16, 0, Math.PI * 2);
    if (bstHoveredNode === node) {
        ctxBstTree.fillStyle = BST_COLOR_HOVER;
        ctxBstTree.strokeStyle = '#fff';
        ctxBstTree.lineWidth = 3;
    } else {
        ctxBstTree.fillStyle = BST_COLOR_NODE;
        if (bstSearchResult && bstSearchResult.bestNode === node) {
            ctxBstTree.strokeStyle = BST_COLOR_BEST;
            ctxBstTree.lineWidth = 3;
        } else if (bstSearchResult && bstSearchResult.visitedNodes.includes(node)) {
            ctxBstTree.strokeStyle = BST_COLOR_VISITED;
            ctxBstTree.lineWidth = 3;
        } else {
            ctxBstTree.strokeStyle = '#fff';
            ctxBstTree.lineWidth = 1.5;
        }
    }
    ctxBstTree.fill();
    ctxBstTree.stroke();

    ctxBstTree.fillStyle = '#fff';
    ctxBstTree.font = '12px "Noto Sans KR", sans-serif';
    ctxBstTree.textAlign = 'center';
    ctxBstTree.textBaseline = 'middle';
    ctxBstTree.fillText(Math.round(node.value), x, y);
}


// --- Interactions ---

// Hover 기능
function getBstHoveredNode(x, y, isTreeCanvas) {
    if (!bstTree || !bstTree.root) return null;
    let closest = null;
    let minDist = 16;
    
    function traverse(node) {
        if (!node) return;
        const nx = isTreeCanvas ? node.treeX : node.lineX;
        const ny = isTreeCanvas ? node.treeY : node.lineY;
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
    traverse(bstTree.root);
    return closest;
}

bstLineCanvas.addEventListener('mousemove', (e) => {
    const rect = bstLineCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (bstLineCanvas.width / rect.width);
    const y = (e.clientY - rect.top) * (bstLineCanvas.height / rect.height);
    
    const node = getBstHoveredNode(x, y, false);
    if (bstHoveredNode !== node) {
        bstHoveredNode = node;
        renderBST();
    }
});

bstLineCanvas.addEventListener('mouseleave', () => {
    bstHoveredNode = null;
    renderBST();
});

bstTreeCanvas.addEventListener('mousemove', (e) => {
    // 드래그 처리
    if (bstTreeDragging) {
        bstTreePanX += e.clientX - bstTreeLastX;
        bstTreePanY += e.clientY - bstTreeLastY;
        bstTreeLastX = e.clientX;
        bstTreeLastY = e.clientY;
        renderBST();
        return;
    }
    // 호버 처리 (줌/팬 보정)
    const rect = bstTreeCanvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (bstTreeCanvas.width / rect.width);
    const sy = (e.clientY - rect.top) * (bstTreeCanvas.height / rect.height);
    const { x, y } = bstScreenToWorld(sx, sy);
    const node = getBstHoveredNode(x, y, true);
    if (bstHoveredNode !== node) {
        bstHoveredNode = node;
        renderBST();
    }
});

bstTreeCanvas.addEventListener('mouseleave', () => {
    bstHoveredNode = null;
    renderBST();
});

// 캔버스 클릭 이벤트 (Number Line 캔버스에서 값을 입력받음)
bstLineCanvas.addEventListener('mousedown', (e) => {
    const rect = bstLineCanvas.getBoundingClientRect();
    const scaleX = bstLineCanvas.width / rect.width;
    const x = (e.clientX - rect.left) * scaleX;
    
    // 0~100 스케일로 변환
    const value = Math.round((x / bstLineCanvas.width) * 100);
    // 제한 (0~100)
    const clampedVal = Math.max(0, Math.min(100, value));

    if (bstValues.length === 0) {
        alert("먼저 [랜덤 추가] 버튼을 눌러 값을 추가해주세요.");
        return;
    }
    bstQuery = clampedVal;
    bstSearchResult = bstTree.search(bstQuery);
    updateBSTStats('검색 수행됨');

    renderBST();
});

document.getElementById('bst-btn-random').addEventListener('click', () => {
    for (let i = 0; i < 7; i++) {
        const val = Math.floor(Math.random() * 101); // 0~100
        if (!bstValues.includes(val)) {
            bstValues.push(val);
            bstTree.insert(val);
        }
    }
    bstQuery = null;
    bstSearchResult = null;
    updateBSTStats('랜덤 7개 추가');
    renderBST();
});

document.getElementById('bst-btn-clear').addEventListener('click', () => {
    bstValues = [];
    bstTree = new BST();
    bstQuery = null;
    bstSearchResult = null;
    updateBSTStats('초기화됨');
    renderBST();
});

// BST 트리 캔버스 줌/팬 이벤트
bstTreeCanvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    bstTreeZoom = Math.max(0.3, Math.min(5, bstTreeZoom * factor));
    renderBST();
}, { passive: false });

bstTreeCanvas.addEventListener('mousedown', (e) => {
    bstTreeDragging = true;
    bstTreeLastX = e.clientX;
    bstTreeLastY = e.clientY;
    e.preventDefault();
});

window.addEventListener('mouseup', () => {
    bstTreeDragging = false;
});

bstTreeCanvas.addEventListener('dblclick', () => {
    bstTreeZoom = 1;
    bstTreePanX = 0;
    bstTreePanY = 0;
    renderBST();
});

// 초기화
setTimeout(() => {
    resizeBSTCanvas();
    updateBSTStats('준비됨');
}, 100);
