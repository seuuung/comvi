// 2차시 스크립트: 모라벡 알고리즘 시뮬레이션

document.addEventListener('DOMContentLoaded', () => {

    /* =====================================================================
       Component 1: Feature Matching (New)
    ===================================================================== */
    const matchCanvas = document.getElementById('matchCanvas');
    const matchCtx = matchCanvas.getContext('2d', { willReadFrequently: true });
    const btnCreateBoxes = document.getElementById('btnCreateBoxes');
    const btnFindCorners = document.getElementById('btnFindCorners');
    const btnMatchPoints = document.getElementById('btnMatchPoints');
    const btnRansac = document.getElementById('btnRansac');
    const btnStitch = document.getElementById('btnStitch');
    const ransacFilters = document.getElementById('ransacFilters');
    const filterRadios = document.querySelectorAll('input[name="ransacFilter"]');

    const stitchCanvas = document.getElementById('stitchCanvas');
    const stitchCtx = stitchCanvas.getContext('2d');
    const stitchResultArea = document.getElementById('stitchResultArea');

    // 코너 개수 슬라이더 추가
    const cornerCountSlider = document.getElementById('corner-count');
    const cornerCountVal = document.getElementById('corner-count-val');
    let maxCorners = parseInt(cornerCountSlider.value, 10);

    cornerCountSlider.addEventListener('input', (e) => {
        maxCorners = parseInt(e.target.value, 10);
        cornerCountVal.innerText = maxCorners;
        // 이미 추출된 상태라면 개수를 변경했을 때 재추출하도록 유도할 수 있습니다.
    });

    let cornersA = [];
    let cornersB = [];
    let matchedPairs = []; // To store best matches for stitching
    let finalRansacResult = null; // RANSAC 연산 결과 캐싱
    let isCornersFound = false;

    // 실제 이미지 로드 (left.jpg, right.jpg)
    let imgLeft = new Image();
    let imgRight = new Image();
    let imagesLoaded = 0;

    function handleImageLoad() {
        imagesLoaded++;
        console.log(`Image loaded: ${imagesLoaded}/2`);
        if (imagesLoaded >= 2) {
            drawImagesOnCanvas();
        }
    }

    imgLeft.onload = handleImageLoad;
    imgRight.onload = handleImageLoad;
    imgLeft.onerror = () => console.error("Failed to load left.jpg");
    imgRight.onerror = () => console.error("Failed to load right.jpg");

    imgLeft.src = 'left.jpg';
    imgRight.src = 'right.jpg';

    // Canvas dimensions & Image layout constants
    const CANVAS_W = 1100;
    const CANVAS_H = 450;
    const IMG_W = 480;
    const IMG_H = 360;
    const IMG_A_X = 20;
    const IMG_B_X = 600;
    const IMG_Y = 45;

    // Backgrounds for A (Left) and B (Right) with 100px Gap
    function drawMatchBg() {
        // Overall BG
        matchCtx.fillStyle = '#020617';
        matchCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // Inner Content BG
        matchCtx.fillStyle = '#0f172a';
        matchCtx.fillRect(IMG_A_X, IMG_Y, IMG_W, IMG_H);
        matchCtx.fillRect(IMG_B_X, IMG_Y, IMG_W, IMG_H);
    }

    /**
     * 실제 이미지를 캔버스에 그리는 함수
     */
    function drawImagesOnCanvas() {
        matchCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        drawMatchBg();

        // Image A (Left): left.jpg
        matchCtx.save();
        matchCtx.beginPath();
        matchCtx.rect(IMG_A_X, IMG_Y, IMG_W, IMG_H);
        matchCtx.clip();
        matchCtx.drawImage(imgLeft, IMG_A_X, IMG_Y, IMG_W, IMG_H);
        matchCtx.restore();

        // Image B (Right): right.jpg
        matchCtx.save();
        matchCtx.beginPath();
        matchCtx.rect(IMG_B_X, IMG_Y, IMG_W, IMG_H);
        matchCtx.clip();
        matchCtx.drawImage(imgRight, IMG_B_X, IMG_Y, IMG_W, IMG_H);
        matchCtx.restore();
    }

    function initMatchSimulation() {
        if (imagesLoaded < 2) {
            // 이미지 로드 대기
            drawMatchBg();
            matchCtx.fillStyle = '#94a3b8';
            matchCtx.font = '14px Inter, Noto Sans KR';
            matchCtx.textAlign = 'center';
            matchCtx.fillText('이미지 로딩 중...', 200, 150);
            matchCtx.fillText('이미지 로딩 중...', 700, 150);
            matchCtx.textAlign = 'start';
            return;
        }

        drawImagesOnCanvas();

        cornersA = [];
        cornersB = [];
        matchedPairs = [];
        finalRansacResult = null;
        isCornersFound = false;
        btnFindCorners.disabled = false;
        btnMatchPoints.disabled = true;
        btnRansac.disabled = true;
        btnRansac.innerText = "4. RANSAC 이상치 제거";
        btnStitch.disabled = true;
        ransacFilters.style.display = 'none';
        stitchResultArea.style.display = 'none';
        stitchInfo.innerText = "";
    }

    /* =====================================================================
       Algorithm Logic: Real Moravec & SSD Matching
    ===================================================================== */

    // 1. Grayscale 변환 헬퍼
    function getGrayscaleData(ctx, x, y, w, h) {
        const imgData = ctx.getImageData(x, y, w, h);
        const pixels = imgData.data;
        const gray = new Float32Array(w * h);
        for (let i = 0; i < pixels.length; i += 4) {
            // 표준 루미넌스 가중치 적용
            gray[i / 4] = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
        }
        return { data: gray, w, h };
    }

    // 2. Real Moravec 알고리즘 구현
    function detectMoravec(isRightImage) {
        const regionX = isRightImage ? IMG_B_X : IMG_A_X;
        const grayObj = getGrayscaleData(matchCtx, regionX, IMG_Y, IMG_W, IMG_H);
        const { data, w, h } = grayObj;

        const scores = new Float32Array(w * h);
        const threshold = 1800; // 해상도 증가에 따라 소폭 상향 조정

        // 4방향 SSD 계산 (가로, 세로, 대각형 2개)
        for (let y = 2; y < h - 2; y++) {
            for (let x = 2; x < w - 2; x++) {
                let ssdDir = [0, 0, 0, 0];
                const shifts = [[1, 0], [0, 1], [1, 1], [-1, 1]];

                for (let s = 0; s < 4; s++) {
                    const [dx, dy] = shifts[s];
                    let sum = 0;
                    // 3x3 윈도우
                    for (let wy = -1; wy <= 1; wy++) {
                        for (let wx = -1; wx <= 1; wx++) {
                            const v1 = data[(y + wy) * w + (x + wx)];
                            const v2 = data[(y + wy + dy) * w + (x + wx + dx)];
                            sum += Math.pow(v1 - v2, 2);
                        }
                    }
                    ssdDir[s] = sum;
                }
                scores[y * w + x] = Math.min(...ssdDir);
            }
        }

        // NMS (Non-Maximum Suppression)
        let rawCorners = [];
        for (let y = 5; y < h - 5; y++) {
            for (let x = 5; x < w - 5; x++) {
                const score = scores[y * w + x];
                if (score < threshold) continue;

                let isLocalMax = true;
                for (let ny = -3; ny <= 3; ny++) {
                    for (let nx = -3; nx <= 3; nx++) {
                        if (scores[(y + ny) * w + (x + nx)] > score) {
                            isLocalMax = false;
                            break;
                        }
                    }
                }
                if (isLocalMax) {
                    rawCorners.push({ x: regionX + x, y: IMG_Y + y, score, localX: x, localY: y });
                }
            }
        }

        // 상위 N개 강한 코너만 선택 (슬라이더 값 사용)
        return rawCorners.sort((a, b) => b.score - a.score).slice(0, maxCorners);
    }

    // 3. SSD 패치 매칭 헬퍼
    function computeMatchScore(grayA, grayB, cA, cB) {
        let ssd = 0;
        const radius = 5; // 11x11 patch
        const wA = grayA.w, hA = grayA.h;
        const wB = grayB.w, hB = grayB.h;

        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const xA = cA.localX + dx, yA = cA.localY + dy;
                const xB = cB.localX + dx, yB = cB.localY + dy;

                if (xA >= 0 && xA < wA && yA >= 0 && yA < hA &&
                    xB >= 0 && xB < wB && yB >= 0 && yB < hB) {
                    ssd += Math.pow(grayA.data[yA * wA + xA] - grayB.data[yB * wB + xB], 2);
                } else {
                    ssd += 1000; // Penalty for border
                }
            }
        }
        return ssd;
    }

    // Buttons
    btnCreateBoxes.addEventListener('click', initMatchSimulation);

    btnFindCorners.addEventListener('click', () => {
        btnFindCorners.innerText = "계산 중...";
        btnFindCorners.disabled = true;

        setTimeout(() => {
            cornersA = detectMoravec(false);
            cornersB = detectMoravec(true);

            matchCtx.fillStyle = '#ef4444';
            [...cornersA, ...cornersB].forEach(pt => {
                matchCtx.beginPath();
                matchCtx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
                matchCtx.fill();
                matchCtx.strokeStyle = '#fff';
                matchCtx.lineWidth = 1;
                matchCtx.stroke();
            });

            btnFindCorners.innerText = "2. 양쪽 영상 코너 위치 추출";
            isCornersFound = true;
            btnMatchPoints.disabled = false;
        }, 100);
    });

    let colorIdx = 0;
    const matchColors = [
        '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', 
        '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', 
        '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'
    ];

    btnMatchPoints.addEventListener('click', () => {
        if (!isCornersFound) return;
        btnMatchPoints.disabled = true;
        matchedPairs = [];
        colorIdx = 0;

        // 실제 패치 기반 SSD 매칭 수행
        const grayA = getGrayscaleData(matchCtx, IMG_A_X, IMG_Y, IMG_W, IMG_H);
        const grayB = getGrayscaleData(matchCtx, IMG_B_X, IMG_Y, IMG_W, IMG_H);

        // 연산량이 많으므로 브라우저 렉 방지를 위해 나눠서 처리
        let currentIdx = 0;
        function findNextMatch() {
            if (currentIdx >= cornersA.length) {
                // 매칭 완료
                btnRansac.disabled = false;
                return;
            }

            const ptA = cornersA[currentIdx];
            let bestScore = Infinity;
            let bestMatch = null;

            // B 영상의 모든 코너와 비교 (Brute-force SSD)
            cornersB.forEach(ptB => {
                const score = computeMatchScore(grayA, grayB, ptA, ptB);
                if (score < bestScore) {
                    bestScore = score;
                    bestMatch = ptB;
                }
            });

            // 매칭 신뢰도 임계값 (매우 낮은 SSD만 통과)
            if (bestMatch && bestScore < 150000) {
                const pairColor = matchColors[colorIdx % matchColors.length];
                colorIdx++;
                
                matchedPairs.push({ ptA, ptB: bestMatch, ssd: bestScore, color: pairColor });

                // 매칭선 그리기
                matchCtx.beginPath();
                matchCtx.moveTo(ptA.x, ptA.y);
                matchCtx.lineTo(bestMatch.x, bestMatch.y);
                matchCtx.strokeStyle = pairColor;
                matchCtx.lineWidth = 1.5;
                matchCtx.stroke();

                // 양쪽 대응점 같은 색으로 덧칠하기
                matchCtx.fillStyle = pairColor;
                matchCtx.beginPath(); matchCtx.arc(ptA.x, ptA.y, 5, 0, Math.PI * 2); matchCtx.fill();
                matchCtx.beginPath(); matchCtx.arc(bestMatch.x, bestMatch.y, 5, 0, Math.PI * 2); matchCtx.fill();
                
                matchCtx.strokeStyle = '#fff';
                matchCtx.lineWidth = 1.5;
                matchCtx.beginPath(); matchCtx.arc(ptA.x, ptA.y, 5, 0, Math.PI * 2); matchCtx.stroke();
                matchCtx.beginPath(); matchCtx.arc(bestMatch.x, bestMatch.y, 5, 0, Math.PI * 2); matchCtx.stroke();
            }

            currentIdx++;
            if (currentIdx % 5 === 0) {
                setTimeout(findNextMatch, 10);
            } else {
                findNextMatch();
            }
        }

        setTimeout(findNextMatch, 50);
    });

    /**
     * RANSAC을 이용한 최적의 이동량(Translation) 추정
     * @param {Array} pairs 매칭된 점들의 배열 {ptA, ptB, ssd}
     * @returns {Object} {dx, dy, inliers} 최적의 이동량과 인라이어 집합
     */
    function estimateTranslationRansac(pairs) {
        if (pairs.length === 0) return { dx: 0, dy: 0, inliers: [] };

        let bestModel = { dx: 0, dy: 0 };
        let maxInliers = -1;
        let bestInliers = [];
        const threshold = 10; // 허용 오차 (픽셀 단위)

        // 모든 매칭 쌍을 모델 후보로 검토 (데이터가 적으므로 전수 조사)
        for (let i = 0; i < pairs.length; i++) {
            const p1 = pairs[i];
            const relAX = p1.ptA.x - IMG_A_X;
            const relAY = p1.ptA.y - IMG_Y;
            const relBX = p1.ptB.x - IMG_B_X;
            const relBY = p1.ptB.y - IMG_Y;
            
            // 모델 후보: p1이 정의하는 이동량
            const dx = relAX - relBX;
            const dy = relAY - relBY;
            
            let inliers = [];
            for (let j = 0; j < pairs.length; j++) {
                const p2 = pairs[j];
                const rAX = p2.ptA.x - IMG_A_X;
                const rAY = p2.ptA.y - IMG_Y;
                const rBX = p2.ptB.x - IMG_B_X;
                const rBY = p2.ptB.y - IMG_Y;
                
                const errX = Math.abs((rAX - rBX) - dx);
                const errY = Math.abs((rAY - rBY) - dy);
                
                if (errX < threshold && errY < threshold) {
                    inliers.push(p2);
                }
            }
            
            if (inliers.length > maxInliers) {
                maxInliers = inliers.length;
                bestModel = { dx, dy };
                bestInliers = inliers;
            }
        }
        
        // 인라이어들의 평균값으로 모델 정밀화 (Refinement)
        if (bestInliers.length > 0) {
            let sumX = 0, sumY = 0;
            bestInliers.forEach(p => {
                 sumX += (p.ptA.x - IMG_A_X) - (p.ptB.x - IMG_B_X);
                 sumY += (p.ptA.y - IMG_Y) - (p.ptB.y - IMG_Y);
            });
            bestModel.dx = sumX / bestInliers.length;
            bestModel.dy = sumY / bestInliers.length;
        }

        // 전체 pairs 중 bestInliers에 포함되지 않은 것들을 outilers로 분류
        const bestInliersSet = new Set(bestInliers);
        const outliers = pairs.filter(p => !bestInliersSet.has(p));
        
        return { ...bestModel, inliers: bestInliers, outliers };
    }

    // ==========================================
    // RANSAC 분석 및 필터 조작
    // ==========================================
    let hoveredPair = null;
    function dist2(v, w) { return (v.x - w.x) ** 2 + (v.y - w.y) ** 2; }
    function distToSegmentSquared(p, v, w) {
        let l2 = dist2(v, w);
        if (l2 === 0) return dist2(p, v);
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return dist2(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
    }
    function distToSegment(p, v, w) { return Math.sqrt(distToSegmentSquared(p, v, w)); }

    function renderRansacLines(mode) {
        if (!finalRansacResult && matchedPairs.length === 0) return;
        const inliers = finalRansacResult ? finalRansacResult.inliers : [];
        const outliers = finalRansacResult ? finalRansacResult.outliers : [];
        const defaultPairs = finalRansacResult ? [] : matchedPairs;

        // 1. 배경 이미지 초기화 및 코너 점 다시 그리기
        matchCtx.clearRect(0, 0, matchCanvas.width, matchCanvas.height);
        drawImagesOnCanvas();
        
        matchCtx.fillStyle = 'rgba(167, 139, 250, 0.8)';
        [...cornersA, ...cornersB].forEach(pt => {
            matchCtx.beginPath();
            matchCtx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
            matchCtx.fill();
            matchCtx.strokeStyle = 'rgba(255,255,255,0.5)';
            matchCtx.lineWidth = 1;
            matchCtx.stroke();
        });

        // 1.5 3단계 매칭선 전부 그리기 (RANSAC 이전)
        if (!finalRansacResult) {
            matchCtx.save();
            matchCtx.setLineDash([]);
            defaultPairs.forEach(p => {
                matchCtx.beginPath();
                matchCtx.moveTo(p.ptA.x, p.ptA.y);
                matchCtx.lineTo(p.ptB.x, p.ptB.y);
                
                const baseColor = p.color || 'rgba(167, 139, 250, 0.7)';
                
                if (hoveredPair && hoveredPair !== p) {
                    matchCtx.globalAlpha = 0.1;
                    matchCtx.strokeStyle = baseColor;
                    matchCtx.lineWidth = 1;
                } else if (hoveredPair === p) {
                    matchCtx.globalAlpha = 1.0;
                    matchCtx.strokeStyle = baseColor;
                    matchCtx.lineWidth = 3;
                } else {
                    matchCtx.globalAlpha = 1.0;
                    matchCtx.strokeStyle = baseColor;
                    matchCtx.lineWidth = 1.5;
                }
                matchCtx.stroke();
                
                // 대응점(코너)을 매칭선과 같은 색으로 덧칠
                matchCtx.fillStyle = baseColor;
                matchCtx.beginPath(); matchCtx.arc(p.ptA.x, p.ptA.y, 5, 0, Math.PI * 2); matchCtx.fill();
                matchCtx.beginPath(); matchCtx.arc(p.ptB.x, p.ptB.y, 5, 0, Math.PI * 2); matchCtx.fill();
                
                matchCtx.strokeStyle = '#fff';
                matchCtx.lineWidth = 1.5;
                matchCtx.beginPath(); matchCtx.arc(p.ptA.x, p.ptA.y, 5, 0, Math.PI * 2); matchCtx.stroke();
                matchCtx.beginPath(); matchCtx.arc(p.ptB.x, p.ptB.y, 5, 0, Math.PI * 2); matchCtx.stroke();
                
                matchCtx.globalAlpha = 1.0; // 복구
            });
            matchCtx.restore();
        }

        // 2. 아웃라이어(Outliers) 선 그리기 (올 보기 또는 아웃라이어 보기)
        if (finalRansacResult && (mode === 'all' || mode === 'outliers')) {
            matchCtx.save();
            matchCtx.setLineDash([]); // 실선으로 변경
            outliers.forEach(p => {
                matchCtx.beginPath();
                matchCtx.moveTo(p.ptA.x, p.ptA.y);
                matchCtx.lineTo(p.ptB.x, p.ptB.y);
                if (hoveredPair && hoveredPair !== p) {
                    matchCtx.globalAlpha = 0.1;
                    matchCtx.strokeStyle = 'rgba(239, 68, 68, 1.0)';
                    matchCtx.lineWidth = 1;
                } else if (hoveredPair === p) {
                    matchCtx.globalAlpha = 1.0;
                    matchCtx.strokeStyle = 'rgba(239, 68, 68, 1.0)';
                    matchCtx.lineWidth = 3;
                } else {
                    matchCtx.globalAlpha = 1.0;
                    matchCtx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
                    matchCtx.lineWidth = 1.5;
                }
                matchCtx.stroke();

                // 마커색 유지
                const baseColor = p.color || 'rgba(167, 139, 250, 0.7)';
                matchCtx.fillStyle = baseColor;
                matchCtx.beginPath(); matchCtx.arc(p.ptA.x, p.ptA.y, 5, 0, Math.PI * 2); matchCtx.fill();
                matchCtx.beginPath(); matchCtx.arc(p.ptB.x, p.ptB.y, 5, 0, Math.PI * 2); matchCtx.fill();
                
                matchCtx.strokeStyle = '#fff';
                matchCtx.lineWidth = 1.5;
                matchCtx.beginPath(); matchCtx.arc(p.ptA.x, p.ptA.y, 5, 0, Math.PI * 2); matchCtx.stroke();
                matchCtx.beginPath(); matchCtx.arc(p.ptB.x, p.ptB.y, 5, 0, Math.PI * 2); matchCtx.stroke();
                
                matchCtx.globalAlpha = 1.0;
            });
            matchCtx.restore();
        }

        // 3. 인라이어(Inliers) 선 그리기 (올 보기 또는 인라이어 보기)
        if (finalRansacResult && (mode === 'all' || mode === 'inliers')) {
            matchCtx.save();
            inliers.forEach(p => {
                matchCtx.beginPath();
                matchCtx.moveTo(p.ptA.x, p.ptA.y);
                matchCtx.lineTo(p.ptB.x, p.ptB.y);
                if (hoveredPair && hoveredPair !== p) {
                    matchCtx.globalAlpha = 0.1;
                    matchCtx.strokeStyle = 'rgba(16, 185, 129, 1.0)';
                    matchCtx.lineWidth = 1.8;
                } else if (hoveredPair === p) {
                    matchCtx.globalAlpha = 1.0;
                    matchCtx.strokeStyle = 'rgba(16, 185, 129, 1.0)';
                    matchCtx.lineWidth = 3.5;
                } else {
                    matchCtx.globalAlpha = 1.0;
                    matchCtx.strokeStyle = '#10b981';
                    matchCtx.lineWidth = 1.8;
                }
                matchCtx.stroke();

                // 마커색 유지
                const baseColor = p.color || 'rgba(167, 139, 250, 0.7)';
                matchCtx.fillStyle = baseColor;
                matchCtx.beginPath(); matchCtx.arc(p.ptA.x, p.ptA.y, 5, 0, Math.PI * 2); matchCtx.fill();
                matchCtx.beginPath(); matchCtx.arc(p.ptB.x, p.ptB.y, 5, 0, Math.PI * 2); matchCtx.fill();
                
                matchCtx.strokeStyle = '#fff';
                matchCtx.lineWidth = 1.5;
                matchCtx.beginPath(); matchCtx.arc(p.ptA.x, p.ptA.y, 5, 0, Math.PI * 2); matchCtx.stroke();
                matchCtx.beginPath(); matchCtx.arc(p.ptB.x, p.ptB.y, 5, 0, Math.PI * 2); matchCtx.stroke();

                matchCtx.globalAlpha = 1.0;
            });
            matchCtx.restore();
        }

        // 호버된 대응점 양쪽 하이라이트 원 그리기
        if (hoveredPair) {
            matchCtx.save();
            matchCtx.beginPath();
            matchCtx.arc(hoveredPair.ptA.x, hoveredPair.ptA.y, 6, 0, Math.PI * 2);
            matchCtx.arc(hoveredPair.ptB.x, hoveredPair.ptB.y, 6, 0, Math.PI * 2);
            matchCtx.fillStyle = 'rgba(250, 204, 21, 0.9)'; // 노란색
            matchCtx.fill();
            matchCtx.strokeStyle = '#fff';
            matchCtx.lineWidth = 2;
            matchCtx.stroke();
            matchCtx.restore();
        }

        // 4. 범례(Legend) 그리기
        if (finalRansacResult) {
        matchCtx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        matchCtx.fillRect(10, 10, 150, 60);
        matchCtx.strokeStyle = 'rgba(255,255,255,0.1)';
        matchCtx.strokeRect(10, 10, 150, 60);
        
        matchCtx.font = '12px Inter, sans-serif';
        matchCtx.fillStyle = '#10b981';
        matchCtx.fillRect(20, 22, 20, 3);
        matchCtx.fillStyle = '#f8fafc';
        matchCtx.fillText(`Inliers (${inliers.length})`, 50, 27);
        matchCtx.strokeStyle = '#ef4444';
        matchCtx.lineWidth = 2;
        matchCtx.setLineDash([]); // 범례도 실선
        matchCtx.beginPath(); matchCtx.moveTo(20, 48); matchCtx.lineTo(40, 48); matchCtx.stroke();
        matchCtx.fillStyle = '#94a3b8';
            matchCtx.fillText(`Outliers (${outliers.length})`, 50, 52);
            matchCtx.restore();
        }
    }

    btnRansac.addEventListener('click', () => {
        btnRansac.innerText = "이상치 분석 중...";
        btnRansac.disabled = true;

        setTimeout(() => {
            finalRansacResult = estimateTranslationRansac(matchedPairs);
            
            // 라디오 초기화를 All로 세팅
            document.querySelector('input[name="ransacFilter"][value="all"]').checked = true;
            ransacFilters.style.display = 'flex';
            
            renderRansacLines('all');
            
            btnRansac.innerText = "4. RANSAC 이상치 제거 완료";
            btnStitch.disabled = false;
        }, 100);
    });

    filterRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            renderRansacLines(e.target.value);
        });
    });

    matchCanvas.addEventListener('mousemove', (e) => {
        if (!finalRansacResult && matchedPairs.length === 0) return;
        const rect = matchCanvas.getBoundingClientRect();
        // 화면에 보여지는 CSS 크기와 캔버스 내부 해상도의 비율 보정
        const scaleX = matchCanvas.width / rect.width;
        const scaleY = matchCanvas.height / rect.height;
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;
        const p = {x: mouseX, y: mouseY};

        let mode = 'all';
        if (finalRansacResult) {
            const checkedRadio = document.querySelector('input[name="ransacFilter"]:checked');
            if (checkedRadio) mode = checkedRadio.value;
        }

        let candidates = [];
        if (!finalRansacResult) {
            candidates = matchedPairs;
        } else {
            if (mode === 'all') candidates = [...finalRansacResult.inliers, ...finalRansacResult.outliers];
            else if (mode === 'inliers') candidates = finalRansacResult.inliers;
            else if (mode === 'outliers') candidates = finalRansacResult.outliers;
        }

        let minDist = Infinity;
        let closest = null;

        candidates.forEach(pair => {
            const d = distToSegment(p, pair.ptA, pair.ptB);
            if (d < minDist) {
                minDist = d;
                closest = pair;
            }
        });

        const threshold = 10; // CSS 보정 거친 후 10픽셀 이내 
        if (minDist < threshold) {
            if (hoveredPair !== closest) {
                hoveredPair = closest;
                renderRansacLines(mode);
            }
        } else {
            if (hoveredPair !== null) {
                hoveredPair = null;
                renderRansacLines(mode);
            }
        }
    });

    matchCanvas.addEventListener('mouseout', () => {
        if (hoveredPair !== null && (finalRansacResult || matchedPairs.length > 0)) {
            hoveredPair = null;
            let mode = 'all';
            if (finalRansacResult) {
                const checkedRadio = document.querySelector('input[name="ransacFilter"]:checked');
                if (checkedRadio) mode = checkedRadio.value;
            }
            renderRansacLines(mode);
        }
    });

    // ==========================================
    // 최종 파노라마 합성 리스너
    // ==========================================
    btnStitch.addEventListener('click', () => {
        stitchResultArea.style.display = 'flex';
        const { dx, dy, inliers } = finalRansacResult;

        // 스케일링 계산 (매칭 캔버스 480 -> 스티칭 캔버스 370)
        const scaleX = 370 / IMG_W;
        const scaleY = 270 / IMG_H;
        
        const finalDX = dx * scaleX;
        const finalDY = dy * scaleY;

        const imgAWidth = 370;
        const imgAHeight = 270;

        // 캔버스 중앙 정렬 및 높이 최적화를 위한 계산
        const totalW = imgAWidth + Math.abs(finalDX);
        const totalH = imgAHeight + Math.abs(finalDY);
        
        // 캔버스 높이를 이미지 합친 높이에 딱 맞춤으로써 하단 텍스트가 바짝 붙게 함
        const canvasHeight = totalH;

        // 스티칭 캔버스는 원래 크기로 복구하되 세로 여백 제거
        stitchCanvas.width = 900;
        stitchCanvas.height = canvasHeight;
        stitchCtx.clearRect(0, 0, 900, canvasHeight);

        // Background for result (Gradient for premium look)
        const bgGrad = stitchCtx.createLinearGradient(0, 0, 0, canvasHeight);
        bgGrad.addColorStop(0, '#0f172a');
        bgGrad.addColorStop(1, '#020617');
        stitchCtx.fillStyle = bgGrad;
        stitchCtx.fillRect(0, 0, 900, canvasHeight);

        const startX = (900 - totalW) / 2;
        const startY = 0; // 상하 여백 없이 위쪽으로 붙여 그립니다.

        // 이미지 A와 B의 그리기 좌표 (dx에 따른 상대 위치)
        const posAX = startX + (finalDX < 0 ? -finalDX : 0);
        const posAY = startY + (finalDY < 0 ? -finalDY : 0);
        const posBX = posAX + finalDX;
        const posBY = posAY + finalDY;

        // 1. 이미지 A (left.jpg) 그리기
        stitchCtx.save();
        stitchCtx.shadowBlur = 15;
        stitchCtx.shadowColor = 'rgba(0,0,0,0.5)';
        stitchCtx.drawImage(imgLeft, posAX, posAY, imgAWidth, imgAHeight);
        stitchCtx.restore();

        // 2. 이미지 B (right.jpg) 오프셋 적용하여 그리기
        stitchCtx.save();
        stitchCtx.drawImage(imgRight, posBX, posBY, imgAWidth, imgAHeight);
        stitchCtx.restore();

        // 중첩 영역 계산 및 표시
        const overlapWidth = Math.max(0, imgAWidth - Math.abs(finalDX));
        const overlapHeight = Math.max(0, imgAHeight - Math.abs(finalDY));

        if (overlapWidth > 0 && inliers.length > 0) {
            const overlapX = posAX + Math.max(0, finalDX);
            const overlapY = posAY + Math.max(0, finalDY);
            
            // 1. 중첩 영역 가이드라인 (점선 박스 및 채우기)
            stitchCtx.strokeStyle = '#10b981'; 
            stitchCtx.lineWidth = 2;
            stitchCtx.setLineDash([8, 4]);
            stitchCtx.strokeRect(overlapX, overlapY, overlapWidth, overlapHeight);
            
            // 연한 녹색으로 투명하게 채우기
            stitchCtx.fillStyle = 'rgba(16, 185, 129, 0.15)'; 
            stitchCtx.fillRect(overlapX, overlapY, overlapWidth, overlapHeight);
            
            stitchCtx.setLineDash([]);

            // 2. 사진 하단 영역에 DOM을 통해 텍스트로 정보 표시
            const overlapInfo = document.getElementById('overlapInfo');
            if (overlapInfo) {
                overlapInfo.innerHTML = `◀ 중첩 영역: <strong>${Math.round(overlapWidth)}px</strong> (Inliers: ${inliers.length}) ▶ <br><span style="font-size: 0.95rem; color: #cbd5e1; font-weight: 400; display: inline-block; margin-top: 5px;">현재 스티칭 박스 내 보정된 최종 이동량: X ${Math.round(finalDX)}px, Y ${Math.round(finalDY)}px</span>`;
            }
        }

        setTimeout(() => {
            stitchResultArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    });

    // 초기 렌더링: 이미지 로드 전 배경만 표시, 로드 완료 시 자동으로 이미지 표시
    drawMatchBg();


    /* =====================================================================
       Component 2: SSD Window Search (Former Component 1)
    ===================================================================== */
    const ssdCanvas = document.getElementById('ssdCanvas');
    const ssdCtx = ssdCanvas.getContext('2d');
    const barChartContainer = document.getElementById('barChartContainer');
    const cScoreEl = document.getElementById('cScore');

    const gridSize = 12;
    const cellSize = ssdCanvas.width / gridSize;

    // Create grid and draw a filled staircase with 1-pixel steps
    let grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));

    // Fill staircase: Each row y has pixels from x=2 to x=y
    for (let y = 2; y <= 9; y++) {
        for (let x = 2; x <= y; x++) {
            grid[y][x] = 1;
        }
    }

    const directions = [
        { name: '상단', dx: 0, dy: -1 },
        { name: '하단', dx: 0, dy: 1 },
        { name: '좌측', dx: -1, dy: 0 },
        { name: '우측', dx: 1, dy: 0 }
    ];

    // Initialize Chart Bars and Preview Canvases
    // First, Add Original Window Preview at the beginning
    const originalContainer = document.createElement('div');
    originalContainer.className = 'bar-container';
    originalContainer.style.marginRight = '1.5rem'; // Separation from shifts

    const originalCanvas = document.createElement('canvas');
    originalCanvas.id = 'original-preview-canvas';
    originalCanvas.width = 45;
    originalCanvas.height = 45;
    originalCanvas.style.border = '2px solid #32c864'; // Green for original
    originalCanvas.style.borderRadius = '4px';
    originalCanvas.style.background = '#0f172a';

    const originalTrack = document.createElement('div');
    originalTrack.className = 'bar-track';
    originalTrack.style.borderBottom = 'none'; // No line for original

    const originalLabel = document.createElement('div');
    originalLabel.innerText = '원본(I)';
    originalLabel.className = 'bar-label';
    originalLabel.style.color = '#32c864';
    originalLabel.style.fontWeight = '700';

    originalContainer.appendChild(originalCanvas);
    originalContainer.appendChild(originalTrack); // Empty track for alignment
    originalContainer.appendChild(originalLabel);
    barChartContainer.appendChild(originalContainer);

    directions.forEach((dir, i) => {
        const barContainer = document.createElement('div');
        barContainer.className = 'bar-container';

        // 3x3 Window Preview Canvas
        const previewCanvas = document.createElement('canvas');
        previewCanvas.id = `preview-canvas-${i}`;
        previewCanvas.width = 45;
        previewCanvas.height = 45;
        previewCanvas.style.border = '1px solid #475569';
        previewCanvas.style.borderRadius = '4px';
        previewCanvas.style.background = '#020617';

        const barTrack = document.createElement('div');
        barTrack.className = 'bar-track';

        const barValue = document.createElement('div');
        barValue.className = 'bar-value';
        barValue.id = `bar-val-${i}`;
        barValue.innerText = '0';

        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.id = `bar-${i}`;
        bar.style.height = '0px';

        barTrack.appendChild(barValue);
        barTrack.appendChild(bar);

        const label = document.createElement('div');
        label.className = 'bar-label';
        label.innerText = dir.name;

        barContainer.appendChild(previewCanvas);
        barContainer.appendChild(barTrack);
        barContainer.appendChild(label);

        barChartContainer.appendChild(barContainer);
    });

    function drawPreview(idx, cx, cy, dx, dy) {
        const pCanvas = document.getElementById(`preview-canvas-${idx}`);
        const pCtx = pCanvas.getContext('2d');
        const pSize = 15;
        pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);

        for (let wy = -1; wy <= 1; wy++) {
            for (let wx = -1; wx <= 1; wx++) {
                const nx = cx + wx;
                const ny = cy + wy;
                const sx = nx + dx;
                const sy = ny + dy;

                const valOriginal = (ny >= 0 && ny < gridSize && nx >= 0 && nx < gridSize) ? grid[ny][nx] : 0;
                const valShifted = (sy >= 0 && sy < gridSize && sx >= 0 && sx < gridSize) ? grid[sy][sx] : 0;

                // Draw cell
                pCtx.fillStyle = valShifted === 1 ? '#e2e8f0' : '#1e293b';
                pCtx.fillRect((wx + 1) * pSize, (wy + 1) * pSize, pSize, pSize);

                // Highlight difference (if brightness changed)
                if (valOriginal !== valShifted) {
                    pCtx.strokeStyle = '#ef4444';
                    pCtx.lineWidth = 1.5;
                    pCtx.strokeRect((wx + 1) * pSize + 1, (wy + 1) * pSize + 1, pSize - 2, pSize - 2);
                } else {
                    pCtx.strokeStyle = '#334155';
                    pCtx.lineWidth = 0.5;
                    pCtx.strokeRect((wx + 1) * pSize, (wy + 1) * pSize, pSize, pSize);
                }
            }
        }
    }

    function drawGrid(highlightX = -1, highlightY = -1) {
        ssdCtx.clearRect(0, 0, ssdCanvas.width, ssdCanvas.height);

        // Draw base grid
        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                ssdCtx.fillStyle = grid[y][x] === 1 ? '#e2e8f0' : '#1e293b';
                ssdCtx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                ssdCtx.strokeStyle = '#334155';
                ssdCtx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }

        // Draw hover window (3x3)
        if (highlightX >= 0 && highlightY >= 0) {
            ssdCtx.fillStyle = 'rgba(239, 68, 68, 0.4)'; // Red overlay for window
            ssdCtx.fillRect((highlightX - 1) * cellSize, (highlightY - 1) * cellSize, cellSize * 3, cellSize * 3);
            ssdCtx.strokeStyle = '#ef4444';
            ssdCtx.lineWidth = 2;
            ssdCtx.strokeRect((highlightX - 1) * cellSize, (highlightY - 1) * cellSize, cellSize * 3, cellSize * 3);
            ssdCtx.lineWidth = 1;
        }
    }

    function calculateSSD(cx, cy) {
        // max SSD for 3x3 window with 0/1 binary values is 9
        const maxSSD = 9;
        let ssds = [];
        let minSSD = Infinity;

        directions.forEach((dir, idx) => {
            let ssd = 0;
            // Iterate over 3x3 window
            for (let wy = -1; wy <= 1; wy++) {
                for (let wx = -1; wx <= 1; wx++) {
                    const nx = cx + wx;
                    const ny = cy + wy;

                    const shiftedX = nx + dir.dx;
                    const shiftedY = ny + dir.dy;

                    // Bounds check
                    const valOriginal = (ny >= 0 && ny < gridSize && nx >= 0 && nx < gridSize) ? grid[ny][nx] : 0;
                    const valShifted = (shiftedY >= 0 && shiftedY < gridSize && shiftedX >= 0 && shiftedX < gridSize) ? grid[shiftedY][shiftedX] : 0;

                    ssd += Math.pow(valOriginal - valShifted, 2);
                }
            }
            ssds.push(ssd);
            minSSD = Math.min(minSSD, ssd);

            // Update UI
            const bar = document.getElementById(`bar-${idx}`);
            const barVal = document.getElementById(`bar-val-${idx}`);

            const heightPx = (ssd / maxSSD) * 100; // max 100px height
            bar.style.height = `${heightPx}px`;
            // Highlight bar if it is the minimum restricting the C score
            if (minSSD === ssd) {
                bar.style.background = 'linear-gradient(to top, #ef4444, #fca5a5)';
            } else {
                bar.style.background = 'linear-gradient(to top, var(--primary), #a78bfa)';
            }
            barVal.innerText = ssd;

            // Draw 3x3 Preview for each direction
            drawPreview(idx, cx, cy, dir.dx, dir.dy);
        });

        // Draw Original 3x3 Preview
        const oCanvas = document.getElementById('original-preview-canvas');
        const oCtx = oCanvas.getContext('2d');
        const pSize = 15;
        oCtx.clearRect(0, 0, oCanvas.width, oCanvas.height);
        for (let wy = -1; wy <= 1; wy++) {
            for (let wx = -1; wx <= 1; wx++) {
                const nx = cx + wx;
                const ny = cy + wy;
                const val = (ny >= 0 && ny < gridSize && nx >= 0 && nx < gridSize) ? grid[ny][nx] : 0;
                oCtx.fillStyle = val === 1 ? '#e2e8f0' : '#1e293b';
                oCtx.fillRect((wx + 1) * pSize, (wy + 1) * pSize, pSize, pSize);
                oCtx.strokeStyle = '#334155';
                oCtx.strokeRect((wx + 1) * pSize, (wy + 1) * pSize, pSize, pSize);
            }
        }

        // Ensure only the absolute minimum bars are red
        directions.forEach((dir, idx) => {
            const bar = document.getElementById(`bar-${idx}`);
            if (ssds[idx] === minSSD && minSSD > 0) {
                bar.style.background = 'linear-gradient(to top, #32c864, #86efac)';
            } else {
                bar.style.background = 'linear-gradient(to top, var(--primary), #a78bfa)';
            }
        });

        // Update C score display
        cScoreEl.innerText = minSSD;
        if (minSSD >= 2) {
            cScoreEl.style.color = '#ff4757';
            cScoreEl.innerText += ' (코너)';
        } else {
            cScoreEl.style.color = '#32c864';
        }
    }

    ssdCanvas.addEventListener('mousemove', (e) => {
        const rect = ssdCanvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / cellSize);
        const y = Math.floor((e.clientY - rect.top) / cellSize);

        drawGrid(x, y);
        calculateSSD(x, y);
    });

    ssdCanvas.addEventListener('mouseleave', () => {
        drawGrid(-1, -1);
        directions.forEach((dir, idx) => {
            document.getElementById(`bar-${idx}`).style.height = '0px';
            document.getElementById(`bar-val-${idx}`).innerText = '0';
            // Clear preview
            const pCanvas = document.getElementById(`preview-canvas-${idx}`);
            pCanvas.getContext('2d').clearRect(0, 0, pCanvas.width, pCanvas.height);
        });
        // Clear original preview
        const oCanvas = document.getElementById('original-preview-canvas');
        oCanvas.getContext('2d').clearRect(0, 0, oCanvas.width, oCanvas.height);
        
        cScoreEl.innerText = '0';
    });

    // Initial draw
    drawGrid(-1, -1);




});
