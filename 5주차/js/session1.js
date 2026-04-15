/**
 * 고급 영상 처리론 - 시뮬레이션 로직
 * 허프 변환 & RANSAC
 */

document.addEventListener("DOMContentLoaded", () => {
    initEdgeLinking();
    initHoughTransform();
    initRansac();
    initApproximation();
});

/* ==============================================================
   0. 에지 연결 (Edge Linking) 시뮬레이션
============================================================== */
function initEdgeLinking() {
    const canvas = document.getElementById('link-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const magRange = document.getElementById('link-mag-threshold');
    const angRange = document.getElementById('link-ang-threshold');
    const magValLabel = document.getElementById('link-mag-val');
    const angValLabel = document.getElementById('link-ang-val');
    const resetBtn = document.getElementById('link-reset-btn');

    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;
    const cols = 12;
    const rows = 6;
    const cellW = (width - padding * 2) / cols;
    const cellH = (height - padding * 2) / rows;

    // 데이터 상태 (고정되어야 함)
    let pixels = [];
    let connections = [];
    let hoveredConn = null;

    // 점과 선분 사이의 거리 계산 (순수 함수)
    function getDistToSegment(px, py, x1, y1, x2, y2) {
        const l2 = (x1 - x2) ** 2 + (y1 - y2) ** 2;
        if (l2 === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
        let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.sqrt((px - (x1 + t * (x2 - x1))) ** 2 + (py - (y1 + t * (y2 - y1))) ** 2);
    }

    // 1. 데이터 생성 (이 버튼을 누를 때만 랜덤값이 생성됨)
    function generateData() {
        const newPixels = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const isEdgeInPattern = Math.abs((c - cols / 2) - (r - rows / 2) * 1.5) < 0.8;
                const isNoise = Math.random() < 0.15;
                if (isEdgeInPattern || isNoise) {
                    const baseMag = isEdgeInPattern ? 70 : 40;
                    const baseAng = isEdgeInPattern ? 45 : Math.random() * 180;
                    newPixels.push({
                        r, c,
                        x: padding + c * cellW + cellW / 2,
                        y: padding + r * cellH + cellH / 2,
                        mag: Math.min(100, Math.max(0, baseMag + (Math.random() - 0.5) * 40)),
                        ang: (baseAng + (Math.random() - 0.5) * 30 + 180) % 180
                    });
                }
            }
        }
        pixels = newPixels;
        updateConnections();
        render();
    }

    // 2. 연결 정보 계산 (임계값 변경 시 호출)
    function updateConnections() {
        const mT = parseInt(magRange.value);
        const aT = parseInt(angRange.value);
        const newConnections = [];
        
        for (let i = 0; i < pixels.length; i++) {
            for (let j = i + 1; j < pixels.length; j++) {
                const p1 = pixels[i];
                const p2 = pixels[j];
                if (Math.abs(p1.r - p2.r) <= 1 && Math.abs(p1.c - p2.c) <= 1) {
                    const magDiff = Math.abs(p1.mag - p2.mag);
                    let angDiff = Math.abs(p1.ang - p2.ang);
                    if (angDiff > 90) angDiff = 180 - angDiff;

                    if (magDiff <= mT && angDiff <= aT) {
                        newConnections.push({ p1, p2, magDiff, angDiff });
                    }
                }
            }
        }
        connections = newConnections;
    }

    // 3. 렌더링 (단순 그리기 전용)
    function render() {
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "#111827";
        ctx.fillRect(0, 0, width, height);

        // 그리드
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 1;
        for (let r = 0; r <= rows; r++) {
            const y = padding + r * cellH;
            ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(width - padding, y); ctx.stroke();
        }
        for (let c = 0; c <= cols; c++) {
            const x = padding + c * cellW;
            ctx.beginPath(); ctx.moveTo(x, padding); ctx.lineTo(x, height - padding); ctx.stroke();
        }

        // 픽셀 배경
        pixels.forEach(p => {
            const opacity = (p.mag / 100) * 0.5;
            ctx.fillStyle = `rgba(59, 130, 246, ${opacity})`;
            ctx.fillRect(padding + p.c * cellW + 1, padding + p.r * cellH + 1, cellW - 2, cellH - 2);
        });

        // 연결선
        connections.forEach(conn => {
            ctx.save();
            ctx.beginPath();
            ctx.lineWidth = 4;
            ctx.strokeStyle = "rgba(239, 68, 68, 0.9)";
            ctx.shadowBlur = 10;
            ctx.shadowColor = "rgba(239, 68, 68, 0.8)";
            ctx.moveTo(conn.p1.x, conn.p1.y);
            ctx.lineTo(conn.p2.x, conn.p2.y);
            ctx.stroke();
            ctx.restore();
        });

        // 화살표 및 텍스트
        pixels.forEach(p => {
            const arrowLen = 34; // 22 -> 34
            const rad = (p.ang * Math.PI) / 180;
            const dx = Math.cos(rad) * arrowLen;
            const dy = -Math.sin(rad) * arrowLen;
            
            ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
            ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
            ctx.lineWidth = 3.5; // 2.5 -> 3.5
            
            ctx.beginPath();
            ctx.moveTo(p.x - dx/2.5, p.y - dy/2.5);
            ctx.lineTo(p.x + dx/2.5, p.y + dy/2.5);
            ctx.stroke();

            const headLen = 15; // 10 -> 15 (더 크고 뚜렷하게)
            const angle = Math.atan2(dy, dx);
            ctx.beginPath();
            ctx.moveTo(p.x + dx/2.5, p.y + dy/2.5);
            ctx.lineTo(p.x + dx/2.5 - headLen * Math.cos(angle - Math.PI / 6), p.y + dy/2.5 - headLen * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(p.x + dx/2.5 - headLen * Math.cos(angle + Math.PI / 6), p.y + dy/2.5 - headLen * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = "#fff";
            ctx.font = "bold 12px Inter"; // 9px -> 12px
            ctx.textAlign = "left"; // 좌측 정렬로 변경
            // 좌측 상단 모서리로 이동 (여백 약간 추가)
            ctx.fillText(`M:${Math.round(p.mag)}`, p.x - cellW/2 + 6, p.y - cellH/2 + 15); // +4, +11 -> +6, +15
            // 좌측 하단 모서리로 이동 (여백 약간 추가)
            ctx.fillText(`A:${Math.round(p.ang)}°`, p.x - cellW/2 + 6, p.y + cellH/2 - 6); // +4, -4 -> +6, -6
        });
    }

    const updateHandler = () => {
        magValLabel.textContent = magRange.value;
        angValLabel.textContent = angRange.value;
        updateConnections();
        render();
    };

    magRange.addEventListener('input', updateHandler);
    angRange.addEventListener('input', updateHandler);
    resetBtn.addEventListener('click', (e) => { e.preventDefault(); generateData(); });

    generateData();
}

/* ==============================================================
   1. 허프 변환 (Hough Transform) 시뮬레이션
============================================================== */
function initHoughTransform() {
    const imgCanvas = document.getElementById('ht-img-canvas');
    const paramCanvas = document.getElementById('ht-param-canvas');
    const clearBtn = document.getElementById('ht-clear-btn');

    const imgCtx = imgCanvas.getContext('2d');
    const paramCtx = paramCanvas.getContext('2d');

    const width = imgCanvas.width;
    const height = imgCanvas.height;

    // 허프 변환 관련 파라미터 (원점이 중심)
    // theta의 범위: 0 ~ 180도 (-90 ~ 90도를 시프트)
    const thetaMax = 180;
    // rho의 최대값은 대각선 길이의 약 절반
    const maxRho = Math.ceil(Math.sqrt((width / 2) ** 2 + (height / 2) ** 2));
    const rhoMax = maxRho * 2; // -maxRho ~ +maxRho

    let points = [];
    let houghLines = []; // [{thetaRad, rho}] 저장 배열
    let accumulator = []; // 2차원 배열 [theta][rho]

    function resetHough() {
        points = [];
        houghLines = [];
        accumulator = Array(thetaMax).fill(null).map(() => Array(rhoMax).fill(0));

        // 파라미터 공간 캔버스 초기화 (배경색 통일)
        paramCtx.fillStyle = "#111827";
        paramCtx.fillRect(0, 0, paramCanvas.width, paramCanvas.height);

        renderImageSpace();
        drawParameterSpace(); // 초기 십자선 및 레이블 렌더링 추가
    }

    function renderImageSpace() {
        imgCtx.fillStyle = "#111827";
        imgCtx.fillRect(0, 0, width, height);
        drawGrid(imgCtx, width, height);

        // 역변환된 직선 그리기 (붉은색)
        houghLines.forEach(line => {
            const { thetaRad, rho } = line;
            imgCtx.strokeStyle = "rgba(239, 68, 68, 0.8)"; // 빨간색
            imgCtx.lineWidth = 2;
            imgCtx.beginPath();

            const sinT = Math.sin(thetaRad);
            const cosT = Math.cos(thetaRad);

            // 영상 원점이 중앙이므로 좌표 보정 필요: x = ix - w/2, y = h/2 - iy
            if (Math.abs(sinT) > 0.01) {
                // y = (rho - x * cos(theta)) / sin(theta)
                const y1 = (rho - (-width / 2) * cosT) / sinT;
                const y2 = (rho - (width / 2) * cosT) / sinT;
                imgCtx.moveTo(0, height / 2 - y1);
                imgCtx.lineTo(width, height / 2 - y2);
            } else {
                // 수직선
                const x1 = rho / cosT;
                imgCtx.moveTo(width / 2 + x1, 0);
                imgCtx.lineTo(width / 2 + x1, height);
            }
            imgCtx.stroke();
        });

        // 기존 점들 다시 그리기
        points.forEach(p => {
            imgCtx.fillStyle = "#3b82f6";
            imgCtx.beginPath();
            imgCtx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            imgCtx.fill();
        });
    }

    function drawGrid(ctx, w, h) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
        ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
        ctx.stroke();
        ctx.setLineDash([]);

        // 축 레이블 표시
        ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        ctx.font = "italic 14px Inter";
        ctx.fillText("x", w - 15, h / 2 - 5);
        ctx.fillText("y", w / 2 + 5, 15);
    }

    function addPoint(x, y) {
        points.push({ x, y });

        renderImageSpace(); // 화면 갱신

        // 원점을 중앙으로 이동하여 계산
        const _x = x - width / 2;
        const _y = Math.floor(height / 2) - y; // y축 방향 반전

        // 허프 변환 파라미터 공간 계산 (곡선 1개 추가)
        for (let t = 0; t < thetaMax; t++) {
            const thetaRad = (t - 90) * Math.PI / 180; // -90도 ~ 89도
            const r = Math.round(_x * Math.cos(thetaRad) + _y * Math.sin(thetaRad));
            // Accumulator 인덱스 보정 (0 ~ rhoMax)
            const rIdx = r + maxRho;

            if (rIdx >= 0 && rIdx < rhoMax) {
                accumulator[t][rIdx]++;
            }
        }
        drawParameterSpace();
    }

    function drawParameterSpace() {
        const pWidth = paramCanvas.width;
        const pHeight = paramCanvas.height;

        // 가장 많이 누적된 값 찾기 
        let maxAcc = 1;
        for (let t = 0; t < thetaMax; t++) {
            for (let r = 0; r < rhoMax; r++) {
                if (accumulator[t][r] > maxAcc) {
                    maxAcc = accumulator[t][r];
                }
            }
        }

        // 점 하나만 찍었을 때 곡선이 완전 하얀색으로 뜨지 않도록 최소 분모 보정 (3정도)
        const effectiveMaxAcc = Math.max(maxAcc, 3);

        const imgData = paramCtx.createImageData(pWidth, pHeight);

        // 픽셀 데이터 배경을 #111827 (17, 24, 39)로 초기화
        for (let i = 0; i < imgData.data.length; i += 4) {
            imgData.data[i] = 17;     // R
            imgData.data[i + 1] = 24; // G
            imgData.data[i + 2] = 39; // B
            imgData.data[i + 3] = 255;// Alpha
        }

        for (let t = 0; t < thetaMax; t++) {
            for (let r = 0; r < rhoMax; r++) {
                const val = accumulator[t][r];
                if (val > 0) {
                    // 매핑: t -> x, rIdx -> y
                    const px = Math.floor((t / thetaMax) * pWidth);
                    const py = Math.floor((r / rhoMax) * pHeight);

                    // 강도를 색상으로 변환 (누적이 많을수룩 effectiveMaxAcc에 가까워지며 밝아짐)
                    const intensity = val / effectiveMaxAcc;
                    const rCol = Math.floor(16 + 239 * intensity);
                    const gCol = Math.floor(185 + 70 * intensity); // 10b981 (16, 185, 129)
                    const bCol = Math.floor(129 + 126 * intensity);

                    // 픽셀 그리기 (여러 픽셀 반경에 블러처럼 그리기 위함)
                    for (let dx = 0; dx < 2; dx++) {
                        for (let dy = 0; dy < 2; dy++) {
                            const idx = ((py + dy) * pWidth + (px + dx)) * 4;
                            if (idx < imgData.data.length) {
                                imgData.data[idx] = Math.max(imgData.data[idx], rCol);
                                imgData.data[idx + 1] = Math.max(imgData.data[idx + 1], gCol);
                                imgData.data[idx + 2] = Math.max(imgData.data[idx + 2], bCol);
                                imgData.data[idx + 3] = 255;
                            }
                        }
                    }
                }
            }
        }
        paramCtx.putImageData(imgData, 0, 0);

        // 파라미터 공간 십자선 (theta, rho 축) - 상태 초기화 후 그리기
        paramCtx.globalAlpha = 1.0;
        paramCtx.setLineDash([5, 5]);
        paramCtx.strokeStyle = "rgba(255, 255, 255, 0.25)"; // 약간 더 선명하게 고정
        paramCtx.lineWidth = 1;
        paramCtx.beginPath();
        paramCtx.moveTo(0, pHeight / 2); paramCtx.lineTo(pWidth, pHeight / 2);
        paramCtx.moveTo(pWidth / 2, 0); paramCtx.lineTo(pWidth / 2, pHeight);
        paramCtx.stroke();
        paramCtx.setLineDash([]);

        // 파라미터 축 레이블
        paramCtx.fillStyle = "rgba(255, 255, 255, 0.6)";
        paramCtx.font = "italic 14px Inter";
        paramCtx.fillText("θ", pWidth - 15, pHeight / 2 - 5);
        paramCtx.fillText("ρ", pWidth / 2 + 5, 15);

        // 추가: 역변환된 직선들의 파라미터 위치(클릭 지점) 표시
        houghLines.forEach((line, index) => {
            const { thetaRad, rho } = line;
            // 라디안/rho -> 인덱스 변환
            const t = Math.round((thetaRad * 180 / Math.PI) + 90);
            const rIdx = rho + maxRho;

            // 인덱스 -> 캔버스 좌표 변환
            const mx = (t / thetaMax) * pWidth;
            const my = (rIdx / rhoMax) * pHeight;

            const isLast = (index === houghLines.length - 1);

            // 마커 스타일 설정 (노란색/금색)
            paramCtx.strokeStyle = isLast ? "#fbbf24" : "#f59e0b";
            paramCtx.lineWidth = isLast ? 3 : 2;
            
            paramCtx.beginPath();
            paramCtx.arc(mx, my, isLast ? 8 : 6, 0, Math.PI * 2);
            paramCtx.stroke();
            
            paramCtx.fillStyle = isLast ? "#fbbf24" : "#f59e0b";
            paramCtx.beginPath();
            paramCtx.arc(mx, my, 2, 0, Math.PI * 2);
            paramCtx.fill();
        });
    }

    imgCanvas.addEventListener('mousedown', (e) => {
        const rect = imgCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        addPoint(x, y);
    });

    // 역변환 이벤트 (파라미터 공간 클릭)
    paramCanvas.addEventListener('mousedown', (e) => {
        const rect = paramCanvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;

        const t = Math.floor((px / paramCanvas.width) * thetaMax);
        const rIdx = Math.floor((py / paramCanvas.height) * rhoMax);

        if (t >= 0 && t < thetaMax && rIdx >= 0 && rIdx < rhoMax) {
            const thetaRad = (t - 90) * Math.PI / 180;
            const rho = rIdx - maxRho;
            houghLines.push({ thetaRad, rho });
            renderImageSpace(); // 추가된 직선 렌더링
            drawParameterSpace(); // 클릭 지점 마커 표시를 위해 다시 그리기
        }
    });

    clearBtn.addEventListener('click', resetHough);
    resetHough();
}

/* ==============================================================
   2. RANSAC 시뮬레이션
============================================================== */
function initRansac() {
    const canvas = document.getElementById('ransac-canvas');
    const ctx = canvas.getContext('2d');
    const resetBtn = document.getElementById('ransac-reset-btn');
    const stepBtn = document.getElementById('ransac-step-btn');
    const autoBtn = document.getElementById('ransac-auto-btn');
    const fullBtn = document.getElementById('ransac-full-btn');

    const uiIterations = document.getElementById('rs-iterations');
    const uiCurrent = document.getElementById('rs-current-inliers');
    const uiBest = document.getElementById('rs-best-inliers');
    const uiMsg = document.getElementById('rs-status-msg');

    const width = canvas.width;
    const height = canvas.height;

    let dataset = [];
    let bestModel = null;
    let stepCount = 0;
    let autoInterval = null;
    let currentSamples = []; // 현재 랜덤하게 뽑힌 점 2개

    // RANSAC 파라미터
    const threshold = 15; // 허용 오차 거리
    const totalPoints = 150;
    const inlierRatio = 0.4;

    function generateData() {
        dataset = [];
        bestModel = null;
        stepCount = 0;
        currentSamples = [];
        stopAutoRun();
        updateUI(0, 0, 0, "데이터가 초기화되었습니다. 버튼을 눌러 샘플링을 시작하세요.");

        // 정답 직선의 파라미터 (임의)
        const a = (Math.random() - 0.5) * 2; // 기울기
        const b = height / 2 + (Math.random() - 0.5) * 100; // y절편

        for (let i = 0; i < totalPoints; i++) {
            let x = Math.random() * width;
            let y;
            if (i < totalPoints * inlierRatio) {
                // Inliers (약간의 노이즈 포함)
                y = a * x + b + (Math.random() - 0.5) * 20;
            } else {
                // Outliers
                y = Math.random() * height;
            }
            // 캔버스 벗어나는 것 방지
            y = Math.max(0, Math.min(height, y));
            dataset.push({ x, y });
        }
        drawRansac(null, [], bestModel);
    }

    // 데이터셋에서 무작위로 점 2개 선택
    function getRandomSamples() {
        const idx1 = Math.floor(Math.random() * dataset.length);
        let idx2 = Math.floor(Math.random() * dataset.length);
        while (idx1 === idx2) {
            idx2 = Math.floor(Math.random() * dataset.length);
        }
        return [dataset[idx1], dataset[idx2]];
    }

    // 1회 랜덤 샘플링 실행
    function runRandomIteration() {
        const samples = getRandomSamples();
        currentSamples = samples;
        stepRansac(samples[0], samples[1]);
    }

    // 자동 실행 시작/중지
    function toggleAutoRun() {
        if (autoInterval) {
            stopAutoRun();
        } else {
            autoBtn.textContent = "중지 (Stop)";
            autoBtn.classList.replace('btn-accent', 'btn-secondary');
            autoInterval = setInterval(() => {
                runRandomIteration();
                // 일정 횟수 이상이거나 어느 정도 만족하면 멈추게 할 수도 있지만, 여기서는 수동 중지 위주
            }, 100);
        }
    }

    function stopAutoRun() {
        if (autoInterval) {
            clearInterval(autoInterval);
            autoInterval = null;
            autoBtn.textContent = "자동 실행";
            autoBtn.classList.replace('btn-secondary', 'btn-accent');
        }
    }

    // 즉시 대량 반복 (최종 결과 찾기)
    function runFullRansac() {
        stopAutoRun();
        const iterations = 100;
        for (let i = 0; i < iterations; i++) {
            const samples = getRandomSamples();
            currentSamples = samples;
            stepRansac(samples[0], samples[1], false); // 드로잉 생략 옵션 가능하지만 여기선 마지막만 그림
        }
        drawRansac(bestModel.model, bestModel.inliers, bestModel);
        updateUI(bestModel.count, bestModel.count, stepCount, `총 ${iterations}회 반복을 즉시 수행하여 최적의 모델을 찾았습니다.`);
    }

    function stepRansac(p1, p2, shouldDraw = true) {
        stepCount++;

        // 직선 방정식 모델 수립 (ax + by + c = 0)
        const a = p2.y - p1.y;
        const b = p1.x - p2.x;
        const c = p2.x * p1.y - p1.x * p2.y;

        // 수직선/수평선 예외 처리 (분모 0 방지)
        if (Math.abs(a) < 0.001 && Math.abs(b) < 0.001) return;

        const currentModel = { a, b, c };

        // 2. Inliers 계산
        let inliers = [];
        let inlierCount = 0;

        for (let i = 0; i < totalPoints; i++) {
            const dist = getDistance(dataset[i], currentModel);
            if (dist < threshold) {
                inliers.push(dataset[i]);
                inlierCount++;
            }
        }

        // 3. Best 갱신
        let isNewBest = false;
        if (!bestModel || inlierCount > bestModel.count) {
            bestModel = { model: currentModel, count: inlierCount, inliers: inliers, p1: p1, p2: p2 };
            isNewBest = true;
        }

        if (shouldDraw) {
            drawRansac(currentModel, inliers, bestModel);
        }

        const bestCount = bestModel ? bestModel.count : 0;
        let msg = `Step ${stepCount}: 2점 랜덤 샘플링. Inlier ${inlierCount}개.`;
        if (isNewBest) msg += " ✨ Best 갱신!";

        updateUI(inlierCount, bestCount, stepCount, msg);
    }

    function drawRansac(currentModel, currentInliers, best) {
        ctx.fillStyle = "#111827";
        ctx.fillRect(0, 0, width, height);

        // 점 렌더링 (일반) 모던한 회색조로 더 밝게
        dataset.forEach(p => drawPoint(p, 'rgba(148, 163, 184, 0.7)', 4));

        // 역대 Best 렌더링
        if (best) {
            // Best Inlier 선명한 파란색 + 흰색 테두리로 가독성 극대화
            best.inliers.forEach(p => {
                drawPoint(p, '#60a5fa', 6);
                ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
                ctx.lineWidth = 1;
                ctx.stroke();
            });
            // Best Line (두껍고 선명하게)
            drawLine(best.model, 'rgba(96, 165, 250, 0.5)', 7);

            // 최고 모델 샘플 점 강조 (반지름 8px로 확대)
            drawHighlitPoint(best.p1, '#60a5fa', 8, "Best");
            drawHighlitPoint(best.p2, '#60a5fa', 8, "Best");
        }

        // 현재 스텝 모델 렌더링
        if (currentModel) {
            // Threshold 영역
            const mag = Math.sqrt(currentModel.a**2 + currentModel.b**2);
            const distOffset = threshold * mag;
            
            const upperModel = { a: currentModel.a, b: currentModel.b, c: currentModel.c - distOffset };
            const lowerModel = { a: currentModel.a, b: currentModel.b, c: currentModel.c + distOffset };

            drawLine(upperModel, 'rgba(16, 185, 129, 0.1)', 1, true);
            drawLine(lowerModel, 'rgba(16, 185, 129, 0.1)', 1, true);

            // 현재 Line
            drawLine(currentModel, '#10b981', 2);
            // 현재 Inliers
            currentInliers.forEach(p => drawPoint(p, '#10b981', 4));
        }

        // 현재 선택된 샘플 점 2개 (가장 눈에 띄게)
        if (currentSamples.length === 2) {
            drawHighlitPoint(currentSamples[0], '#ef4444', 8, "Sample");
            drawHighlitPoint(currentSamples[1], '#ef4444', 8, "Sample");
            
            // 점 사이를 잇는 붉은 점선 (모델 생성 근거)
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = "rgba(239, 68, 68, 0.5)";
            ctx.beginPath();
            ctx.moveTo(currentSamples[0].x, currentSamples[0].y);
            ctx.lineTo(currentSamples[1].x, currentSamples[1].y);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    // 강조된 점 그리기 (테두리 + 텍스트)
    function drawHighlitPoint(p, color, size, label) {
        if (!p) return;
        ctx.shadowBlur = 15;
        ctx.shadowColor = color;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "#fff";
        ctx.font = "bold 10px Inter";
        ctx.textAlign = "center";
        ctx.fillText(label, p.x, p.y - size - 5);
    }

    function drawPoint(p, color, size = 3) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawLine(model, color, lineWidth = 2, isDashed = false) {
        if (!model) return;
        const { a, b, c } = model;
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        if (isDashed) ctx.setLineDash([5, 5]);
        else ctx.setLineDash([]);

        ctx.beginPath();
        if (Math.abs(b) > 0.001) {
            const y0 = -c / b;
            const y1 = (-a * width - c) / b;
            ctx.moveTo(0, y0);
            ctx.lineTo(width, y1);
        } else {
            const x = -c / a;
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }

    function getDistance(p, model) {
        const { a, b, c } = model;
        return Math.abs(a * p.x + b * p.y + c) / Math.sqrt(a * a + b * b);
    }

    function updateUI(curr, best, iter, msg) {
        uiIterations.textContent = iter;
        uiCurrent.textContent = curr;
        uiBest.textContent = best;
        uiMsg.textContent = msg;
    }

    resetBtn.addEventListener('click', generateData);
    stepBtn.addEventListener('click', runRandomIteration);
    autoBtn.addEventListener('click', toggleAutoRun);
    fullBtn.addEventListener('click', runFullRansac);

    generateData();
}

/* ==============================================================
   3. 선분 근사 (Edge Approximation / RDP) 시뮬레이션
============================================================== */
function initApproximation() {
    const canvas = document.getElementById('approx-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resetBtn = document.getElementById('approx-reset-btn');
    const clearBtn = document.getElementById('approx-clear-btn');
    const thRange = document.getElementById('approx-threshold');
    const thValLabel = document.getElementById('approx-threshold-val');
    const msgUI = document.getElementById('approx-status-msg');

    let isDrawing = false;
    let curvePoints = [];
    let validSegments = []; // 임계치를 만족한 최종 선분들 (기준선 역할)
    let currentThreshold = parseInt(thRange.value);

    thRange.addEventListener('input', (e) => {
        currentThreshold = parseInt(e.target.value);
        thValLabel.textContent = currentThreshold;
        if (curvePoints.length > 0) {
            runFullRDP();
        }
    });

    // 거리 계산 함수 (점 p3에서 p1, p2를 지나는 직선까지의 거리)
    function perpendicularDistance(p3, p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;

        if (dx === 0 && dy === 0) {
            return Math.sqrt((p3.x - p1.x) ** 2 + (p3.y - p1.y) ** 2);
        }
        return Math.abs(dy * p3.x - dx * p3.y + p2.x * p1.y - p2.y * p1.x) / Math.sqrt(dx * dx + dy * dy);
    }

    function drawDefaultCurve() {
        curvePoints = [];
        const w = canvas.width;
        const h = canvas.height;
        const drawWidth = w - 60;
        for (let x = 30; x <= w - 30; x += 3) {
            // 한 사이클 (0 ~ 2π)의 기본 사인파 생성
            const theta = ((x - 30) / drawWidth) * Math.PI * 2;
            const y = h / 2 - Math.sin(theta) * (h / 3);
            curvePoints.push({ x, y });
        }
        runFullRDP();
    }

    function clearCanvas() {
        curvePoints = [];
        validSegments = [];
        renderApprox();
        msgUI.innerHTML = "캔버스가 초기화되었습니다. 마우스로 자유롭게 곡선을 그려 선분 근사를 테스트해보세요.";
    }

    function renderApprox() {
        // 배경 초기화
        ctx.fillStyle = "#111827";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (curvePoints.length === 0) return;

        // 1. 원본 곡선 렌더링 (하얀색 얇은 선)
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(curvePoints[0].x, curvePoints[0].y);
        for (let i = 1; i < curvePoints.length; i++) {
            ctx.lineTo(curvePoints[i].x, curvePoints[i].y);
        }
        ctx.stroke();

        // 1-2. 기준 선분이 포괄하는 임계값(Threshold) 허용 범위 밴드 그리기
        ctx.strokeStyle = "rgba(16, 185, 129, 0.15)"; // 반투명 초록
        ctx.lineCap = "round";
        validSegments.forEach(seg => {
            const p1 = curvePoints[seg.startIdx];
            const p2 = curvePoints[seg.endIdx];
            ctx.lineWidth = currentThreshold * 2; // 양방향으로 threshold (총 지름 역할)
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        });
        ctx.lineCap = "butt"; // 원상 복구

        // 2. 검사가 끝난 최종 선분 (초록색, 이것이 '기준이 되는 선' 역할 수행)
        ctx.strokeStyle = "#10b981"; // 초록색
        ctx.lineWidth = 3;
        validSegments.forEach(seg => {
            const p1 = curvePoints[seg.startIdx];
            const p2 = curvePoints[seg.endIdx];
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();

            // 끝점, 시작점 동그라미
            drawPoint(p1, "#34d399", 5);
            drawPoint(p2, "#34d399", 5);
        });
    }

    function drawPoint(p, color, size = 3) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
    }

    // 전체 RDP 일괄(즉시) 실행 함수
    function runFullRDP() {
        if (curvePoints.length < 2) {
            validSegments = [];
            renderApprox();
            return;
        }
        // 전체 곡선에 대해 재귀적으로 선분 분할 수행
        validSegments = rdpRecursive(0, curvePoints.length - 1);
        renderApprox();
        msgUI.innerHTML = `임계값 <i>h</i> = <strong>${currentThreshold}px</strong> 기준으로 <strong>${validSegments.length}개</strong>의 선분으로 근사되었습니다. 슬라이더를 조절해보세요.`;
    }

    // 재귀 RDP 함수
    function rdpRecursive(startIdx, endIdx) {
        if (endIdx <= startIdx + 1) {
            return [{ startIdx, endIdx }];
        }

        let maxDist = 0;
        let maxDistIdx = startIdx;
        const p1 = curvePoints[startIdx];
        const p2 = curvePoints[endIdx];

        // 해당 선분 구간 내에서 직선(p1~p2)과 가장 먼 점을 탐색
        for (let i = startIdx + 1; i < endIdx; i++) {
            const d = perpendicularDistance(curvePoints[i], p1, p2);
            if (d > maxDist) {
                maxDist = d;
                maxDistIdx = i;
            }
        }

        // 최대 거리가 임계값보다 크면 해당 지점을 기준으로 분할(재귀)
        if (maxDist > currentThreshold) {
            const leftSegments = rdpRecursive(startIdx, maxDistIdx);
            const rightSegments = rdpRecursive(maxDistIdx, endIdx);
            return leftSegments.concat(rightSegments);
        } else {
            // 기준 충족 - 현재 선분을 확정 및 반환
            return [{ startIdx, endIdx }];
        }
    }

    // 캔버스 드로잉 이벤트
    canvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        // mousedown 시점에는 상태만 변경하고, addCanvasPoint 내부나 
        // 실제 유의미한 드로잉 시작 시점에 초기화하도록 유도
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;
        
        // 첫 번째 점을 찍기 직전에만 기존 데이터를 지움
        if (curvePoints.length === 0 || (curvePoints.length > 0 && validSegments.length > 0)) {
            curvePoints = [];
            validSegments = [];
        }
        
        addCanvasPoint(e);
    });

    canvas.addEventListener('mouseup', () => endDrawing());
    canvas.addEventListener('mouseleave', () => {
        if (isDrawing) endDrawing();
    });

    function addCanvasPoint(e) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // 포인트 간 거리가 너무 가까우면 스킵 (렌더링 최적화)
        if (curvePoints.length > 0) {
            const lastP = curvePoints[curvePoints.length - 1];
            if (Math.abs(lastP.x - x) < 2 && Math.abs(lastP.y - y) < 2) return;
        }

        curvePoints.push({ x, y });
        renderApprox(); // 그리는 도중에는 곡선만 표시
    }

    function endDrawing() {
        if (!isDrawing) return;
        isDrawing = false;

        if (curvePoints.length > 2) {
            runFullRDP(); // 그리기 종료 시 바로 RDP 적용
        }
    }

    resetBtn.addEventListener('click', drawDefaultCurve);
    clearBtn.addEventListener('click', clearCanvas);

    // 초기 시작 시 기본 제공 곡선 렌더링
    drawDefaultCurve();
}
