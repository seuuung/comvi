document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('lshCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // 논리 공간 범위 (교안과 유사한 4x4 공간)
    const SPACE_MAX = 4;
    const PADDING = 40;

    // 데이터
    let points = [];
    let hashTables = [];   // L개의 해시 테이블
    let queryPoint = null;
    let queryCandidates = [];
    let actualNN = null;

    // UI 요소
    const numHashSlider = document.getElementById('lsh-num-hash');
    const numHashVal = document.getElementById('lsh-num-hash-val');
    const numTableSlider = document.getElementById('lsh-num-table');
    const numTableVal = document.getElementById('lsh-num-table-val');
    const intervalWidthSlider = document.getElementById('lsh-interval-width');
    const intervalWidthVal = document.getElementById('lsh-interval-width-val');

    // 구간 색상 팔레트
    const INTERVAL_COLORS = [
        '#ff6b6b', '#51cf66', '#339af0', '#fcc419',
        '#cc5de8', '#20c997', '#ff922b', '#748ffc',
        '#f06595', '#66d9e8', '#a9e34b', '#e599f7',
        '#5c7cfa', '#ffa94d', '#69db7c', '#da77f2'
    ];

    // 해시 테이블별 분할선 색상
    const TABLE_COLORS = [
        'rgba(100, 149, 237, 0.45)',  // 파랑 (테이블 1)
        'rgba(255, 99, 71, 0.45)',    // 빨강 (테이블 2)
        'rgba(50, 205, 50, 0.45)'     // 초록 (테이블 3)
    ];

    // ---- 좌표 변환 ---- //
    function toCanvasX(lx) {
        return PADDING + (lx / SPACE_MAX) * (canvas.width - PADDING * 2);
    }
    function toCanvasY(ly) {
        return PADDING + (ly / SPACE_MAX) * (canvas.height - PADDING * 2);
    }
    function toLogicalX(cx) {
        return ((cx - PADDING) / (canvas.width - PADDING * 2)) * SPACE_MAX;
    }
    function toLogicalY(cy) {
        return ((cy - PADDING) / (canvas.height - PADDING * 2)) * SPACE_MAX;
    }

    // ---- 캔버스 리사이즈 ---- //
    function resizeCanvas() {
        canvas.width = 0;
        canvas.height = 0;
        const parent = canvas.parentElement;
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        render();
    }
    window.addEventListener('resize', resizeCanvas);

    // ================================================================
    // 알고리즘 7-7: 위치의존 해시 테이블 구축
    // 입력: 특징 벡터 집합 X, 해시 함수 개수 k, 해시 테이블 개수 L
    // 출력: L개의 해시 테이블
    // ================================================================
    function buildHashTables() {
        const k = parseInt(numHashSlider.value);   // 해시 함수 개수
        const L = parseInt(numTableSlider.value);   // 해시 테이블 개수
        const w = parseFloat(intervalWidthSlider.value); // 구간 너비

        hashTables = [];

        // for j = 1 to L
        for (let j = 0; j < L; j++) {
            const hashFuncs = [];

            // for i = 1 to k: 가우시안 분포에 따른 난수로 (r, b) 설정
            for (let i = 0; i < k; i++) {
                const angle = Math.random() * Math.PI;
                const r = { x: Math.cos(angle), y: Math.sin(angle) };
                const b = Math.random() * w;
                hashFuncs.push({ r, b, w });
            }

            // 해시 함수 g_j = (h1, h2, ..., hk) 구성
            // 모든 점을 해당 주소의 구간에 담기
            const intervals = {};
            points.forEach(p => {
                const key = computeHashKey(p, hashFuncs);
                if (!intervals[key]) intervals[key] = [];
                intervals[key].push(p);
            });

            hashTables.push({ hashFuncs, intervals });
        }
    }

    // 단일 해시 함수 계산: h(x) = floor((r·x + b) / w)
    function computeSingleHash(point, hf) {
        const proj = hf.r.x * point.x + hf.r.y * point.y;
        return Math.floor((proj + hf.b) / hf.w);
    }

    // 복합 해시 키 계산: g(x) = [h1(x), h2(x), ..., hk(x)]
    function computeHashKey(point, hashFuncs) {
        const values = hashFuncs.map(hf => computeSingleHash(point, hf));
        return '[' + values.join(',') + ']';
    }

    // ================================================================
    // 알고리즘 7-8: 위치의존 해시 테이블에서 검색
    // 입력: L개의 해시 테이블, 특징 벡터 x, 매개변수 R과 N
    // 출력: 근사 최근접 이웃 x_nearest
    // ================================================================
    function searchLSH(query) {
        const candidateSet = new Set(); // Q = ∅ (근사 최근접 이웃 후보 저장)
        const candidates = [];

        // for j = 1 to L
        for (let j = 0; j < hashTables.length; j++) {
            const table = hashTables[j];
            const key = computeHashKey(query, table.hashFuncs);

            // j번째 해시 테이블에서 주소 g_j(x)인 구간을 조사
            const interval = table.intervals[key] || [];

            // 이 구간에 있는 점들을 Q에 추가
            interval.forEach(p => {
                const id = `${p.x},${p.y}`;
                if (!candidateSet.has(id)) {
                    candidateSet.add(id);
                    candidates.push(p);
                }
            });
        }

        // Q에서 거리가 가장 짧은 것을 x_nearest로 취함
        let nearest = null;
        let nearestDist = Infinity;
        candidates.forEach(p => {
            const d = (p.x - query.x) ** 2 + (p.y - query.y) ** 2;
            if (d < nearestDist) {
                nearestDist = d;
                nearest = p;
            }
        });

        return { candidates, nearest, nearestDist };
    }

    // 전수 조사로 최근접 이웃 찾기 (비교용)
    function findTrueNN(query) {
        let nearest = null;
        let nearestDist = Infinity;
        points.forEach(p => {
            const d = (p.x - query.x) ** 2 + (p.y - query.y) ** 2;
            if (d < nearestDist) {
                nearestDist = d;
                nearest = p;
            }
        });
        return nearest;
    }

    // ---- 렌더링 ---- //
    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();
        drawHashLines();
        drawPoints();
        drawQuery();
    }

    function drawGrid() {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 1;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '13px "Noto Sans KR", sans-serif';

        for (let i = 0; i <= SPACE_MAX; i += 1) {
            const cx = toCanvasX(i);
            const cy = toCanvasY(i);

            // 세로/가로 그리드선
            ctx.beginPath();
            ctx.moveTo(cx, toCanvasY(0));
            ctx.lineTo(cx, toCanvasY(SPACE_MAX));
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(toCanvasX(0), cy);
            ctx.lineTo(toCanvasX(SPACE_MAX), cy);
            ctx.stroke();

            // X축 라벨 (상단)
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(i.toFixed(1), cx, toCanvasY(0) - 4);

            // Y축 라벨 (왼쪽)
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(i.toFixed(1), toCanvasX(0) - 6, cy);
        }

        // 축 이름
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = 'bold 14px "Noto Sans KR", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('x₁', toCanvasX(SPACE_MAX) + 20, toCanvasY(0) - 4);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText('x₂', toCanvasX(0) - 6, toCanvasY(SPACE_MAX) + 20);
        ctx.restore();
    }

    // 해시 분할선 그리기 (테이블별 다른 색상)
    function drawHashLines() {
        if (hashTables.length === 0) return;

        hashTables.forEach((table, tIdx) => {
            const color = TABLE_COLORS[tIdx % TABLE_COLORS.length];

            table.hashFuncs.forEach((hf) => {
                ctx.save();
                ctx.strokeStyle = color;
                ctx.lineWidth = 1.2;
                ctx.setLineDash([5, 4]);

                // r·x = k*w - b 인 평행선들
                for (let k = -5; k <= 15; k++) {
                    const val = k * hf.w - hf.b;
                    drawProjectionLine(hf.r, val);
                }
                ctx.restore();
            });

            // 테이블 라벨
            ctx.save();
            ctx.fillStyle = color;
            ctx.font = 'bold 13px "Noto Sans KR", sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            const labelY = toCanvasY(0) + 4 + tIdx * 18;
            const k = table.hashFuncs.length;
            ctx.fillText(`테이블 ${tIdx + 1} (k=${k})`, toCanvasX(0) + 4, labelY);
            ctx.restore();
        });
    }

    // r·x = val 인 직선
    function drawProjectionLine(r, val) {
        const pts = [];
        const eps = 1e-9;
        const lo = -0.5, hi = SPACE_MAX + 0.5;

        if (Math.abs(r.y) > eps) {
            const y1 = (val - r.x * lo) / r.y;
            if (y1 >= lo && y1 <= hi) pts.push({ x: lo, y: y1 });
            const y2 = (val - r.x * hi) / r.y;
            if (y2 >= lo && y2 <= hi) pts.push({ x: hi, y: y2 });
        }
        if (Math.abs(r.x) > eps) {
            const x1 = (val - r.y * lo) / r.x;
            if (x1 > lo && x1 < hi) pts.push({ x: x1, y: lo });
            const x2 = (val - r.y * hi) / r.x;
            if (x2 > lo && x2 < hi) pts.push({ x: x2, y: hi });
        }

        if (pts.length >= 2) {
            ctx.beginPath();
            ctx.moveTo(toCanvasX(pts[0].x), toCanvasY(pts[0].y));
            ctx.lineTo(toCanvasX(pts[1].x), toCanvasY(pts[1].y));
            ctx.stroke();
        }
    }

    // 점 그리기
    function drawPoints() {
        // 구간별 색상 매핑 (첫 번째 테이블 기준)
        let colorMap = {};
        if (hashTables.length > 0) {
            const firstTable = hashTables[0];
            const keys = Object.keys(firstTable.intervals);
            keys.forEach((key, idx) => {
                colorMap[key] = INTERVAL_COLORS[idx % INTERVAL_COLORS.length];
            });
        }

        points.forEach(p => {
            const cx = toCanvasX(p.x);
            const cy = toCanvasY(p.y);
            const isCandidate = queryCandidates.includes(p);
            const isActualNN = actualNN === p;

            ctx.beginPath();
            if (isActualNN && queryPoint) {
                // 최근접 이웃: 별도 표시
                ctx.arc(cx, cy, 9, 0, Math.PI * 2);
                ctx.fillStyle = '#ff6b6b';
                ctx.fill();
                ctx.lineWidth = 2.5;
                ctx.strokeStyle = '#fff';
                ctx.stroke();
            } else if (isCandidate) {
                // LSH 후보 점: 강조
                ctx.arc(cx, cy, 7, 0, Math.PI * 2);
                ctx.fillStyle = '#ffd43b';
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#fff';
                ctx.stroke();
            } else if (hashTables.length > 0) {
                // 해시된 점: 첫 테이블 구간 색상
                const key = computeHashKey(p, hashTables[0].hashFuncs);
                ctx.arc(cx, cy, 5, 0, Math.PI * 2);
                ctx.fillStyle = colorMap[key] || 'rgba(255,255,255,0.5)';
                ctx.fill();
            } else {
                // 미해시 점
                ctx.arc(cx, cy, 4, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.fill();
            }
        });
    }

    // 쿼리 포인트 + 결과 그리기
    function drawQuery() {
        if (!queryPoint) return;
        const cx = toCanvasX(queryPoint.x);
        const cy = toCanvasY(queryPoint.y);

        // 쿼리 → 실제 NN 연결선
        if (actualNN) {
            const nnCx = toCanvasX(actualNN.x);
            const nnCy = toCanvasY(actualNN.y);
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(nnCx, nnCy);
            ctx.strokeStyle = 'rgba(255, 107, 107, 0.5)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 3]);
            ctx.stroke();
            ctx.restore();
        }

        // 쿼리 점
        ctx.beginPath();
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#e599f7';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#fff';
        ctx.stroke();

        // 라벨
        ctx.fillStyle = '#e599f7';
        ctx.font = 'bold 15px "Noto Sans KR", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`쿼리 (${queryPoint.x.toFixed(1)}, ${queryPoint.y.toFixed(1)})`, cx + 12, cy - 4);

        // 범례
        ctx.font = '13px "Noto Sans KR", sans-serif';
        ctx.fillStyle = '#ffd43b';
        ctx.fillText(`● 후보: ${queryCandidates.length}개`, cx + 12, cy + 12);
        if (actualNN) {
            const found = queryCandidates.includes(actualNN);
            ctx.fillStyle = found ? '#51cf66' : '#ff6b6b';
            ctx.fillText(`● 최근접 이웃: ${found ? '후보에 포함 ✅' : '후보에 미포함 ❌'}`, cx + 12, cy + 26);
        }
    }

    // ---- 이벤트 핸들러 ---- //

    // 데이터 생성
    document.getElementById('lsh-generate').addEventListener('click', () => {
        points = [];
        queryPoint = null;
        queryCandidates = [];
        actualNN = null;
        hashTables = [];

        for (let i = 0; i < 20; i++) {
            points.push({
                x: Math.round(Math.random() * SPACE_MAX * 10) / 10,
                y: Math.round(Math.random() * SPACE_MAX * 10) / 10
            });
        }

        document.getElementById('lsh-status').textContent = '20개 점 생성됨. [해시 분할] 버튼을 눌러주세요.';
        render();
    });

    // 해시 분할 (알고리즘 7-7)
    document.getElementById('lsh-hash').addEventListener('click', () => {
        if (points.length === 0) {
            document.getElementById('lsh-status').textContent = '먼저 데이터를 생성해주세요.';
            return;
        }
        queryPoint = null;
        queryCandidates = [];
        actualNN = null;

        buildHashTables();

        const L = hashTables.length;
        const k = hashTables[0].hashFuncs.length;
        const totalIntervals = hashTables.reduce((sum, t) => sum + Object.keys(t.intervals).length, 0);
        document.getElementById('lsh-status').textContent =
            `L=${L}개 테이블 × k=${k}개 해시 함수 → 총 ${totalIntervals}개 구간. 캔버스를 클릭하여 쿼리하세요.`;
        render();
    });

    // 캔버스 클릭 → 검색 (알고리즘 7-8)
    canvas.addEventListener('click', (e) => {
        if (hashTables.length === 0) {
            document.getElementById('lsh-status').textContent = '먼저 해시 분할을 수행해주세요.';
            return;
        }
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const cx = (e.clientX - rect.left) * scaleX;
        const cy = (e.clientY - rect.top) * scaleY;

        queryPoint = {
            x: Math.round(toLogicalX(cx) * 10) / 10,
            y: Math.round(toLogicalY(cy) * 10) / 10
        };

        // 알고리즘 7-8 실행
        const result = searchLSH(queryPoint);
        queryCandidates = result.candidates;

        // 전수 조사로 실제 NN 찾기
        actualNN = findTrueNN(queryPoint);
        const found = actualNN && queryCandidates.includes(actualNN);

        const L = hashTables.length;
        document.getElementById('lsh-status').textContent =
            `L=${L}개 테이블에서 후보 ${queryCandidates.length}개 수집. 최근접 이웃 ${found ? '포함 ✅' : '미포함 ❌'}`;
        render();
    });

    // 초기화
    document.getElementById('lsh-clear').addEventListener('click', () => {
        points = [];
        hashTables = [];
        queryPoint = null;
        queryCandidates = [];
        actualNN = null;
        document.getElementById('lsh-status').textContent = '초기화되었습니다.';
        render();
    });

    // 슬라이더 값 표시
    numHashSlider.addEventListener('input', (e) => {
        numHashVal.textContent = e.target.value;
    });
    numTableSlider.addEventListener('input', (e) => {
        numTableVal.textContent = e.target.value;
    });
    intervalWidthSlider.addEventListener('input', (e) => {
        intervalWidthVal.textContent = parseFloat(e.target.value).toFixed(1);
    });

    setTimeout(resizeCanvas, 100);
});
