// 3차시 스크립트: 해리스 코너 / SUSAN / NMS 시뮬레이션
// 모든 알고리즘은 외부 라이브러리 없이 순수 JavaScript로 구현

document.addEventListener('DOMContentLoaded', () => {

    /* =====================================================================
       공통 유틸리티: 프리셋 영상 생성
    ===================================================================== */

    /**
     * 프리셋 영상을 그레이스케일 2D 배열로 생성
     * @param {string} presetName - 'checker' | 'shapes' | 'building'
     * @param {number} size - 이미지 크기 (정사각형)
     * @returns {number[][]} 그레이스케일 2D 배열 [y][x], 0~255
     */
    function generatePreset(presetName, size) {
        const img = Array.from({ length: size }, () => Array(size).fill(0));
        const s = size / 400; // 스케일 배율 (기준 400)

        if (presetName === 'checker') {
            // 체커보드 패턴 - 코너가 많이 발생
            const blockSize = Math.floor(size / 8);
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const bx = Math.floor(x / blockSize);
                    const by = Math.floor(y / blockSize);
                    img[y][x] = (bx + by) % 2 === 0 ? 220 : 40;
                }
            }
        } else if (presetName === 'shapes') {
            // 다양한 도형 - 코너/에지/평면 혼재
            // 배경
            for (let y = 0; y < size; y++)
                for (let x = 0; x < size; x++)
                    img[y][x] = 30;

            // 사각형 1 (밝은 회색)
            for (let y = Math.floor(60 * s); y < Math.floor(160 * s); y++)
                for (let x = Math.floor(40 * s); x < Math.floor(180 * s); x++)
                    if (y < size && x < size) img[y][x] = 200;

            // 사각형 2 (중간 회색)
            for (let y = Math.floor(200 * s); y < Math.floor(330 * s); y++)
                for (let x = Math.floor(50 * s); x < Math.floor(150 * s); x++)
                    if (y < size && x < size) img[y][x] = 160;

            // 삼각형 (밝은색)
            for (let y = Math.floor(100 * s); y < Math.floor(300 * s); y++) {
                const halfWidth = Math.floor((y - 100 * s) * 0.7);
                const cx = Math.floor(300 * s);
                for (let x = cx - halfWidth; x <= cx + halfWidth; x++) {
                    if (y >= 0 && y < size && x >= 0 && x < size) img[y][x] = 230;
                }
            }

            // 작은 사각형들 (고대비)
            for (let y = Math.floor(30 * s); y < Math.floor(70 * s); y++)
                for (let x = Math.floor(250 * s); x < Math.floor(290 * s); x++)
                    if (y < size && x < size) img[y][x] = 240;
            for (let y = Math.floor(30 * s); y < Math.floor(70 * s); y++)
                for (let x = Math.floor(320 * s); x < Math.floor(370 * s); x++)
                    if (y < size && x < size) img[y][x] = 180;

            // L자 모양
            for (let y = Math.floor(230 * s); y < Math.floor(370 * s); y++)
                for (let x = Math.floor(220 * s); x < Math.floor(260 * s); x++)
                    if (y < size && x < size) img[y][x] = 210;
            for (let y = Math.floor(330 * s); y < Math.floor(370 * s); y++)
                for (let x = Math.floor(260 * s); x < Math.floor(360 * s); x++)
                    if (y < size && x < size) img[y][x] = 210;

        } else if (presetName === 'building') {
            // 건물 실루엣 - 수직/수평 에지와 코너
            for (let y = 0; y < size; y++)
                for (let x = 0; x < size; x++)
                    img[y][x] = 45; // 하늘 배경

            // 큰 건물 1
            for (let y = Math.floor(100 * s); y < size; y++)
                for (let x = Math.floor(30 * s); x < Math.floor(120 * s); x++)
                    if (y < size && x < size) img[y][x] = 140;
            // 창문들
            for (let wy = Math.floor(120 * s); wy < size - Math.floor(20 * s); wy += Math.floor(40 * s)) {
                for (let wx = Math.floor(45 * s); wx < Math.floor(105 * s); wx += Math.floor(25 * s)) {
                    for (let y = wy; y < wy + Math.floor(20 * s); y++)
                        for (let x = wx; x < wx + Math.floor(15 * s); x++)
                            if (y < size && x < size) img[y][x] = 220;
                }
            }

            // 큰 건물 2 (더 높음)
            for (let y = Math.floor(50 * s); y < size; y++)
                for (let x = Math.floor(140 * s); x < Math.floor(210 * s); x++)
                    if (y < size && x < size) img[y][x] = 170;
            // 창문들
            for (let wy = Math.floor(70 * s); wy < size - Math.floor(20 * s); wy += Math.floor(35 * s)) {
                for (let wx = Math.floor(155 * s); wx < Math.floor(195 * s); wx += Math.floor(25 * s)) {
                    for (let y = wy; y < wy + Math.floor(18 * s); y++)
                        for (let x = wx; x < wx + Math.floor(12 * s); x++)
                            if (y < size && x < size) img[y][x] = 60;
                }
            }

            // 중간 건물
            for (let y = Math.floor(180 * s); y < size; y++)
                for (let x = Math.floor(230 * s); x < Math.floor(290 * s); x++)
                    if (y < size && x < size) img[y][x] = 120;

            // 높은 탑
            for (let y = Math.floor(30 * s); y < size; y++)
                for (let x = Math.floor(310 * s); x < Math.floor(350 * s); x++)
                    if (y < size && x < size) img[y][x] = 190;

            // 낮은 건물
            for (let y = Math.floor(280 * s); y < size; y++)
                for (let x = Math.floor(360 * s); x < size - Math.floor(10 * s); x++)
                    if (y < size && x < size) img[y][x] = 100;
        } else if (presetName === 'noise_shapes') {
            // 노이즈 패턴 고정을 위한 단순 LCG 난수 생성기
            let seed = 42;
            const seededRandom = () => {
                seed = (seed * 9301 + 49297) % 233280;
                return seed / 233280;
            };

            // 노이즈 함유 도형 (교육용) - 가우시안 블러의 효과를 확인하기 위함
            const base = generatePreset('shapes', size);
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const rand = seededRandom();
                    if (rand < 0.05) img[y][x] = 255;
                    else if (rand < 0.1) img[y][x] = 0;
                    else img[y][x] = Math.max(0, Math.min(255, base[y][x] + (seededRandom() - 0.5) * 60));
                }
            }
        } else if (presetName === 'rotated_checker') {
            // 45도 회전된 체커보드 - 회전 불변성(Rotation Invariance) 테스트
            const blockSize = Math.floor(size / 10);
            const angle = Math.PI / 4; // 45도
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const cx = size / 2;
            const cy = size / 2;

            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const tx = x - cx;
                    const ty = y - cy;
                    const rx = tx * cos - ty * sin;
                    const ry = tx * sin + ty * cos;
                    const bx = Math.floor((rx + 1000) / blockSize);
                    const by = Math.floor((ry + 1000) / blockSize);
                    img[y][x] = (bx + by) % 2 === 0 ? 220 : 40;
                }
            }
        }

        return img;
    }

    /**
     * 그레이스케일 2D 배열을 캔버스에 렌더링
     */
    function drawGrayImage(ctx, img, canvasW, canvasH) {
        const h = img.length;
        const w = img[0].length;
        const imageData = ctx.createImageData(w, h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const idx = (y * w + x) * 4;
                const v = Math.max(0, Math.min(255, Math.round(img[y][x])));
                imageData.data[idx] = v;
                imageData.data[idx + 1] = v;
                imageData.data[idx + 2] = v;
                imageData.data[idx + 3] = 255;
            }
        }
        // 임시 캔버스로 확대 렌더링
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        tempCanvas.getContext('2d').putImageData(imageData, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tempCanvas, 0, 0, canvasW, canvasH);
    }


    /* =====================================================================
       시뮬레이션 1: 해리스 코너 검출기 (Harris Corner Detector)
    ===================================================================== */
    const harrisCanvas = document.getElementById('harris-canvas');
    const harrisCtx = harrisCanvas.getContext('2d');
    const eigenCanvas = document.getElementById('harris-eigen-canvas');
    const eigenCtx = eigenCanvas.getContext('2d');
    const responseCanvas = document.getElementById('harris-response-canvas');
    const responseCtx = responseCanvas.getContext('2d');

    const harrisPreset = document.getElementById('harris-preset');
    const harrisKSlider = document.getElementById('harris-k');
    const harrisKVal = document.getElementById('harris-k-val');
    const harrisThresholdSlider = document.getElementById('harris-threshold');
    const harrisThresholdVal = document.getElementById('harris-threshold-val');
    const harrisSigmaSlider = document.getElementById('harris-sigma');
    const harrisSigmaVal = document.getElementById('harris-sigma-val');
    const harrisRunBtn = document.getElementById('harris-run-btn');
    const harrisStatus = document.getElementById('harris-status');
    const harrisLegend = document.getElementById('harris-legend');

    // 슬라이더 UI 업데이트
    harrisKSlider.addEventListener('input', () => {
        harrisKVal.textContent = (parseInt(harrisKSlider.value) / 100).toFixed(2);
    });
    harrisThresholdSlider.addEventListener('input', () => {
        harrisThresholdVal.textContent = harrisThresholdSlider.value;
    });
    harrisSigmaSlider.addEventListener('input', () => {
        harrisSigmaVal.textContent = (parseInt(harrisSigmaSlider.value) / 10).toFixed(1);
    });

    /**
     * 1D 가우시안 커널 생성
     */
    function gaussianKernel1D(sigma, size) {
        const kernel = [];
        const half = Math.floor(size / 2);
        let sum = 0;
        for (let i = -half; i <= half; i++) {
            const val = Math.exp(-(i * i) / (2 * sigma * sigma));
            kernel.push(val);
            sum += val;
        }
        return kernel.map(v => v / sum);
    }

    /**
     * 분리형 가우시안 블러 (2D → 1D+1D)
     */
    function gaussianBlur2D(data, w, h, sigma) {
        const kSize = Math.ceil(sigma * 3) * 2 + 1;
        const kernel = gaussianKernel1D(sigma, kSize);
        const half = Math.floor(kSize / 2);
        const temp = new Float32Array(w * h);
        const result = new Float32Array(w * h);

        // 수평 방향
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let sum = 0;
                for (let k = -half; k <= half; k++) {
                    const nx = Math.min(w - 1, Math.max(0, x + k));
                    sum += data[y * w + nx] * kernel[k + half];
                }
                temp[y * w + x] = sum;
            }
        }
        // 수직 방향
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let sum = 0;
                for (let k = -half; k <= half; k++) {
                    const ny = Math.min(h - 1, Math.max(0, y + k));
                    sum += temp[ny * w + x] * kernel[k + half];
                }
                result[y * w + x] = sum;
            }
        }
        return result;
    }

    /**
     * 해리스 코너 검출 알고리즘 (실제 구현)
     * 1) Sobel 필터로 Ix, Iy 계산
     * 2) Ix², IxIy, Iy² 계산
     * 3) 가우시안 가중 합
     * 4) 2차 모멘트 행렬의 고유값 λ₁, λ₂ 계산
     * 5) R = det(A) - k·trace(A)² 계산
     */
    function harrisCornerDetection(grayImg, k, sigma, thresholdPercent) {
        const h = grayImg.length;
        const w = grayImg[0].length;

        // 1D 배열로 변환
        const gray = new Float32Array(w * h);
        for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++)
                gray[y * w + x] = grayImg[y][x];

        // Sobel 필터로 미분
        const Ix = new Float32Array(w * h);
        const Iy = new Float32Array(w * h);

        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                // Sobel X: [[-1,0,1],[-2,0,2],[-1,0,1]]
                Ix[y * w + x] =
                    -gray[(y - 1) * w + (x - 1)] + gray[(y - 1) * w + (x + 1)]
                    - 2 * gray[y * w + (x - 1)] + 2 * gray[y * w + (x + 1)]
                    - gray[(y + 1) * w + (x - 1)] + gray[(y + 1) * w + (x + 1)];

                // Sobel Y: [[-1,-2,-1],[0,0,0],[1,2,1]]
                Iy[y * w + x] =
                    -gray[(y - 1) * w + (x - 1)] - 2 * gray[(y - 1) * w + x] - gray[(y - 1) * w + (x + 1)]
                    + gray[(y + 1) * w + (x - 1)] + 2 * gray[(y + 1) * w + x] + gray[(y + 1) * w + (x + 1)];
            }
        }

        // Ix², IxIy, Iy² 계산
        const Ix2 = new Float32Array(w * h);
        const Iy2 = new Float32Array(w * h);
        const IxIy = new Float32Array(w * h);

        for (let i = 0; i < w * h; i++) {
            Ix2[i] = Ix[i] * Ix[i];
            Iy2[i] = Iy[i] * Iy[i];
            IxIy[i] = Ix[i] * Iy[i];
        }

        // 가우시안 가중 합 (2차 모멘트 행렬의 각 성분)
        const sIx2 = gaussianBlur2D(Ix2, w, h, sigma);
        const sIy2 = gaussianBlur2D(Iy2, w, h, sigma);
        const sIxIy = gaussianBlur2D(IxIy, w, h, sigma);

        // 코너 응답 R 계산 + 고유값 저장
        const R = new Float32Array(w * h);
        const eigenValues = []; // {x, y, l1, l2, R}

        let maxR = -Infinity;
        let minR = Infinity;

        for (let y = 2; y < h - 2; y++) {
            for (let x = 2; x < w - 2; x++) {
                const idx = y * w + x;
                const a = sIx2[idx];
                const b = sIxIy[idx];
                const c = sIy2[idx];

                // det(A) = a*c - b*b, trace(A) = a + c
                const det = a * c - b * b;
                const trace = a + c;
                const r = det - k * trace * trace;

                R[idx] = r;
                if (r > maxR) maxR = r;
                if (r < minR) minR = r;

                // 고유값 계산: λ = (trace ± sqrt(trace² - 4·det)) / 2
                const disc = trace * trace - 4 * det;
                const sqrtDisc = disc > 0 ? Math.sqrt(disc) : 0;
                const l1 = (trace + sqrtDisc) / 2;
                const l2 = (trace - sqrtDisc) / 2;

                // 산점도용 (너무 많으면 샘플링)
                if ((y % 3 === 0 && x % 3 === 0) || Math.abs(r) > maxR * 0.01) {
                    eigenValues.push({ x, y, l1: Math.abs(l1), l2: Math.abs(l2), r });
                }
            }
        }

        // 임계값 적용하여 코너 검출
        const threshold = maxR * (thresholdPercent / 100);
        const corners = [];

        for (let y = 5; y < h - 5; y++) {
            for (let x = 5; x < w - 5; x++) {
                if (R[y * w + x] > threshold) {
                    // 간단한 NMS (5x5) - 동일 값 처리 개선
                    let isMax = true;
                    const val = R[y * w + x];
                    for (let dy = -2; dy <= 2 && isMax; dy++) {
                        for (let dx = -2; dx <= 2 && isMax; dx++) {
                            if (dy === 0 && dx === 0) continue;
                            const neighborVal = R[(y + dy) * w + (x + dx)];
                            if (dy < 0 || (dy === 0 && dx < 0)) {
                                if (neighborVal >= val) isMax = false;
                            } else {
                                if (neighborVal > val) isMax = false;
                            }
                        }
                    }
                    if (isMax) {
                        corners.push({ x, y, r: val });
                    }
                }
            }
        }

        return { R, corners, eigenValues, maxR, minR, w, h };
    }

    /**
     * 고유값 산점도 그리기
     */
    function drawEigenScatter(ctx, eigenValues) {
        const cw = ctx.canvas.width;
        const ch = ctx.canvas.height;
        ctx.clearRect(0, 0, cw, ch);

        // 배경
        ctx.fillStyle = '#0a0f1a';
        ctx.fillRect(0, 0, cw, ch);

        // 축 레이블
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(40, ch - 40);
        ctx.lineTo(cw - 10, ch - 40);
        ctx.moveTo(40, ch - 40);
        ctx.lineTo(40, 10);
        ctx.stroke();

        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px Inter, Noto Sans KR';
        ctx.fillText('λ₁', cw - 25, ch - 25);
        ctx.fillText('λ₂', 15, 20);

        // 영역 표시
        // 코너 영역 (우상단)
        ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
        ctx.fillRect(cw * 0.5, 10, cw * 0.48, ch * 0.45);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.5)';
        ctx.font = 'bold 11px Inter';
        ctx.fillText('코너', cw * 0.65, 30);

        // 에지 영역 (우하단 + 좌상단)
        ctx.fillStyle = 'rgba(234, 179, 8, 0.06)';
        ctx.fillRect(cw * 0.5, ch * 0.5, cw * 0.48, ch * 0.38);
        ctx.fillRect(40, 10, cw * 0.35, ch * 0.45);
        ctx.fillStyle = 'rgba(234, 179, 8, 0.5)';
        ctx.fillText('에지', cw * 0.65, ch * 0.65);
        ctx.fillText('에지', 80, 30);

        // 평면 영역 (좌하단)
        ctx.fillStyle = 'rgba(59, 130, 246, 0.06)';
        ctx.fillRect(40, ch * 0.5, cw * 0.35, ch * 0.38);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.5)';
        ctx.fillText('평면', 80, ch * 0.65);

        if (eigenValues.length === 0) return;

        // 스케일 계산
        let maxL = 0;
        for (const ev of eigenValues) {
            if (ev.l1 > maxL) maxL = ev.l1;
            if (ev.l2 > maxL) maxL = ev.l2;
        }
        if (maxL === 0) maxL = 1;

        const plotW = cw - 60;
        const plotH = ch - 60;

        // 점 그리기
        for (const ev of eigenValues) {
            const px = 40 + (ev.l1 / maxL) * plotW;
            const py = (ch - 40) - (ev.l2 / maxL) * plotH;

            // 분류에 따른 색상
            const minL = Math.min(ev.l1, ev.l2);
            const maxLv = Math.max(ev.l1, ev.l2);
            const ratio = maxL > 0 ? minL / maxL : 0;

            let color;
            if (minL < maxL * 0.02 && maxLv < maxL * 0.02) {
                color = 'rgba(59, 130, 246, 0.4)';  // 평면
            } else if (minL < maxL * 0.05 && maxLv > maxL * 0.05) {
                color = 'rgba(234, 179, 8, 0.5)';   // 에지
            } else if (minL > maxL * 0.05 && maxLv > maxL * 0.05) {
                color = 'rgba(239, 68, 68, 0.6)';   // 코너
            } else {
                color = 'rgba(148, 163, 184, 0.3)';
            }

            ctx.beginPath();
            ctx.arc(px, py, 2, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
        }

        // 대각선 보조선 (λ₁ = λ₂)
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(40, ch - 40);
        ctx.lineTo(cw - 10, 10);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '10px Inter';
        ctx.fillText('λ₁ = λ₂', cw - 60, 40);
    }

    /**
     * 코너 응답 R 히트맵 그리기
     */
    function drawResponseMap(ctx, R, corners, w, h) {
        const cw = ctx.canvas.width;
        const ch = ctx.canvas.height;

        // R값 정규화
        let maxR = -Infinity, minR = Infinity;
        for (let i = 0; i < R.length; i++) {
            if (R[i] > maxR) maxR = R[i];
            if (R[i] < minR) minR = R[i];
        }
        const range = maxR - Math.min(0, minR);

        const imageData = ctx.createImageData(w, h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const idx = (y * w + x) * 4;
                const val = R[y * w + x];

                if (val > 0) {
                    // 양수: 노란색~빨간색 (코너 응답)
                    const norm = Math.min(1, val / maxR);
                    const intensity = Math.pow(norm, 0.5) * 255;
                    imageData.data[idx] = intensity;
                    imageData.data[idx + 1] = intensity * 0.6;
                    imageData.data[idx + 2] = 0;
                } else {
                    // 음수: 파란색 (에지 응답)
                    const norm = Math.min(1, Math.abs(val) / Math.abs(minR));
                    imageData.data[idx] = 0;
                    imageData.data[idx + 1] = 0;
                    imageData.data[idx + 2] = Math.pow(norm, 0.5) * 100;
                }
                imageData.data[idx + 3] = 255;
            }
        }

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        tempCanvas.getContext('2d').putImageData(imageData, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tempCanvas, 0, 0, cw, ch);

        // 코너 표시
        const scaleX = cw / w;
        const scaleY = ch / h;
        corners.forEach(pt => {
            ctx.beginPath();
            ctx.arc(pt.x * scaleX, pt.y * scaleY, 4, 0, Math.PI * 2);
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(pt.x * scaleX, pt.y * scaleY, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
        });
    }

    // 해리스 실행 버튼
    harrisRunBtn.addEventListener('click', () => {
        harrisRunBtn.textContent = '계산 중...';
        harrisRunBtn.disabled = true;

        setTimeout(() => {
            const preset = harrisPreset.value;
            const k = parseInt(harrisKSlider.value) / 100;
            const sigma = parseInt(harrisSigmaSlider.value) / 10;
            const threshPercent = parseInt(harrisThresholdSlider.value);

            const SIZE = 200; // 내부 연산용 크기 (성능)
            const grayImg = generatePreset(preset, SIZE);

            const result = harrisCornerDetection(grayImg, k, sigma, threshPercent);

            // 원본 영상 + 코너 표시
            drawGrayImage(harrisCtx, grayImg, harrisCanvas.width, harrisCanvas.height);
            const scaleX = harrisCanvas.width / SIZE;
            const scaleY = harrisCanvas.height / SIZE;
            result.corners.forEach(pt => {
                harrisCtx.beginPath();
                harrisCtx.arc(pt.x * scaleX, pt.y * scaleY, 5, 0, Math.PI * 2);
                harrisCtx.strokeStyle = '#ef4444';
                harrisCtx.lineWidth = 2.5;
                harrisCtx.stroke();
                harrisCtx.beginPath();
                harrisCtx.arc(pt.x * scaleX, pt.y * scaleY, 2, 0, Math.PI * 2);
                harrisCtx.fillStyle = '#fff';
                harrisCtx.fill();
            });

            // 고유값 산점도
            drawEigenScatter(eigenCtx, result.eigenValues);

            // 코너 응답/특징 가능성 히트맵
            drawResponseMap(responseCtx, result.R, result.corners, result.w, result.h);

            // 상태 갱신
            harrisStatus.innerHTML = `<strong>검출 완료</strong> 파라미터: <i>k</i>=${k}, <i>&sigma;</i>=${sigma}, 임계값=${threshPercent}% | 검출된 코너: <span style="color:#ef4444; font-size:1.3rem; font-weight:800;">${result.corners.length}</span>개`;
            harrisLegend.textContent = `검출된 코너: ${result.corners.length}개 (빨간 원으로 표시)`;

            harrisRunBtn.textContent = '검출 실행';
            harrisRunBtn.disabled = false;
        }, 50);
    });

    // 초기 프리셋 렌더링
    {
        const initImg = generatePreset('shapes', 200);
        drawGrayImage(harrisCtx, initImg, harrisCanvas.width, harrisCanvas.height);
        drawEigenScatter(eigenCtx, []);
        // 빈 응답 맵
        responseCtx.fillStyle = '#0a0f1a';
        responseCtx.fillRect(0, 0, responseCanvas.width, responseCanvas.height);
        responseCtx.fillStyle = '#94a3b8';
        responseCtx.font = '14px Inter, Noto Sans KR';
        responseCtx.textAlign = 'center';
        responseCtx.fillText('검출 실행 후 표시됩니다', responseCanvas.width / 2, responseCanvas.height / 2);
        responseCtx.textAlign = 'start';
    }

    // 프리셋 변경 시 미리보기
    harrisPreset.addEventListener('change', () => {
        const initImg = generatePreset(harrisPreset.value, 200);
        drawGrayImage(harrisCtx, initImg, harrisCanvas.width, harrisCanvas.height);
    });


    /* =====================================================================
       시뮬레이션 2: SUSAN 알고리즘
    ===================================================================== */
    const susanCanvas = document.getElementById('susan-canvas');
    const susanCtx = susanCanvas.getContext('2d');
    const susanMaskView = document.getElementById('susan-mask-view');
    const susanMaskCtx = susanMaskView.getContext('2d');
    const susanThresholdSlider = document.getElementById('susan-threshold');
    const susanThresholdVal = document.getElementById('susan-threshold-val');
    const susanRatioBar = document.getElementById('susan-ratio-bar');
    const susanRatioText = document.getElementById('susan-ratio-text');
    const susanVerdict = document.getElementById('susan-verdict');
    const susanSimilarCount = document.getElementById('susan-similar-count');
    const susanCenterVal = document.getElementById('susan-center-val');
    const susanDetectBtn = document.getElementById('susan-detect-btn');
    const susanResetBtn = document.getElementById('susan-reset-btn');

    // SUSAN용 격자 데이터 생성 (계단 + L자 모양)
    const SUSAN_GRID_SIZE = 25; // 격자 크기
    const SUSAN_CELL_SIZE = susanCanvas.width / SUSAN_GRID_SIZE;
    let susanGrid = Array.from({ length: SUSAN_GRID_SIZE }, () => Array(SUSAN_GRID_SIZE).fill(30));

    // 밝은 영역 그리기 (다양한 특징점 생성용)
    // 큰 사각형 (평면 내부, 에지 경계, 코너 꼭짓점)
    for (let y = 4; y < 13; y++)
        for (let x = 3; x < 14; x++)
            susanGrid[y][x] = 200;

    // L자 모양
    for (let y = 4; y < 21; y++)
        for (let x = 16; x < 20; x++)
            susanGrid[y][x] = 180;
    for (let y = 16; y < 21; y++)
        for (let x = 16; x < 23; x++)
            susanGrid[y][x] = 180;

    // 작은 사각형
    for (let y = 16; y < 21; y++)
        for (let x = 4; x < 9; x++)
            susanGrid[y][x] = 220;

    /**
     * SUSAN 원형 마스크 정의 (반지름 ≈ 3.4, 37 픽셀)
     * 실제 SUSAN에서 사용하는 원형 마스크 좌표 (상대좌표)
     */
    const SUSAN_MASK = [];
    const SUSAN_RADIUS = 3.4;
    for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
            if (Math.sqrt(dx * dx + dy * dy) <= SUSAN_RADIUS + 0.1) {
                SUSAN_MASK.push([dx, dy]);
            }
        }
    }
    // 37개가 되어야 하지만 근사적으로 가까운 수가 됨

    let susanDetectedCorners = [];

    function drawSusanGrid(highlightX = -1, highlightY = -1) {
        susanCtx.clearRect(0, 0, susanCanvas.width, susanCanvas.height);
        const cs = SUSAN_CELL_SIZE;

        for (let y = 0; y < SUSAN_GRID_SIZE; y++) {
            for (let x = 0; x < SUSAN_GRID_SIZE; x++) {
                const v = susanGrid[y][x];
                susanCtx.fillStyle = `rgb(${v},${v},${v})`;
                susanCtx.fillRect(x * cs, y * cs, cs, cs);
                susanCtx.strokeStyle = 'rgba(100,100,100,0.3)';
                susanCtx.strokeRect(x * cs, y * cs, cs, cs);
            }
        }

        // 검출된 코너 표시
        susanDetectedCorners.forEach(pt => {
            susanCtx.beginPath();
            susanCtx.arc((pt.x + 0.5) * cs, (pt.y + 0.5) * cs, cs * 0.4, 0, Math.PI * 2);
            susanCtx.strokeStyle = '#ef4444';
            susanCtx.lineWidth = 2;
            susanCtx.stroke();
        });

        // 마스크 하이라이트
        if (highlightX >= 0 && highlightY >= 0) {
            const t = parseInt(susanThresholdSlider.value);
            const centerVal = susanGrid[highlightY]?.[highlightX] ?? 0;
            let similarSum = 0;

            // 마스크 영역 표시 (SUSAN 유사도 함수: c = exp(-(diff/t)^6))
            SUSAN_MASK.forEach(([dx, dy]) => {
                const nx = highlightX + dx;
                const ny = highlightY + dy;
                if (nx < 0 || nx >= SUSAN_GRID_SIZE || ny < 0 || ny >= SUSAN_GRID_SIZE) return;

                const diff = susanGrid[ny][nx] - centerVal;
                const cVal = Math.exp(-Math.pow(diff / t, 6));
                similarSum += cVal;
                const isSimilar = cVal >= 0.5;

                if (isSimilar) {
                    susanCtx.fillStyle = 'rgba(16, 185, 129, 0.5)'; // 유사 = 초록
                } else {
                    susanCtx.fillStyle = 'rgba(239, 68, 68, 0.4)';  // 비유사 = 빨강
                }
                susanCtx.fillRect(nx * cs, ny * cs, cs, cs);
            });

            // 중심점 강조
            susanCtx.fillStyle = 'rgba(59, 130, 246, 0.8)';
            susanCtx.fillRect(highlightX * cs, highlightY * cs, cs, cs);

            // 마스크 외곽선
            susanCtx.strokeStyle = '#60a5fa';
            susanCtx.lineWidth = 2;
            susanCtx.beginPath();
            susanCtx.arc((highlightX + 0.5) * cs, (highlightY + 0.5) * cs, (SUSAN_RADIUS + 0.5) * cs, 0, Math.PI * 2);
            susanCtx.stroke();

            // 정보 업데이트
            updateSusanInfo(centerVal, similarSum, SUSAN_MASK.length);
            drawSusanMaskDetail(highlightX, highlightY, t);
        }
    }

    /**
     * 미니 마스크 뷰 그리기
     */
    function drawSusanMaskDetail(cx, cy, threshold) {
        const mw = susanMaskView.width;
        const mh = susanMaskView.height;
        susanMaskCtx.clearRect(0, 0, mw, mh);

        // 배경
        susanMaskCtx.fillStyle = '#0a0f1a';
        susanMaskCtx.beginPath();
        susanMaskCtx.arc(mw / 2, mh / 2, mw / 2, 0, Math.PI * 2);
        susanMaskCtx.fill();

        const cellW = mw / 9;
        const cellH = mh / 9;
        const centerVal = susanGrid[cy]?.[cx] ?? 0;

        SUSAN_MASK.forEach(([dx, dy]) => {
            const nx = cx + dx;
            const ny = cy + dy;
            const px = (dx + 4) * cellW;
            const py = (dy + 4) * cellH;

            if (nx < 0 || nx >= SUSAN_GRID_SIZE || ny < 0 || ny >= SUSAN_GRID_SIZE) {
                susanMaskCtx.fillStyle = '#1e293b';
                susanMaskCtx.fillRect(px + 0.5, py + 0.5, cellW - 1, cellH - 1);
                return;
            }

            const val = susanGrid[ny][nx];
            const diff = val - centerVal;
            const cVal = Math.exp(-Math.pow(diff / threshold, 6));
            const isSimilar = cVal >= 0.5;

            if (dx === 0 && dy === 0) {
                susanMaskCtx.fillStyle = '#3b82f6';
            } else if (isSimilar) {
                susanMaskCtx.fillStyle = '#10b981';
            } else {
                susanMaskCtx.fillStyle = '#ef4444';
            }
            susanMaskCtx.fillRect(px + 0.5, py + 0.5, cellW - 1, cellH - 1);

            // 밝기값 표시
            susanMaskCtx.fillStyle = '#fff';
            susanMaskCtx.font = '9px monospace';
            susanMaskCtx.textAlign = 'center';
            susanMaskCtx.fillText(val, px + cellW / 2, py + cellH / 2 + 3);
        });

        susanMaskCtx.textAlign = 'start';
    }

    /**
     * USAN 정보 패널 업데이트
     */
    function updateSusanInfo(centerVal, similarCount, totalMask) {
        const ratio = (similarCount / totalMask * 100);
        susanRatioText.textContent = ratio.toFixed(1) + '%';
        susanRatioBar.style.width = ratio + '%';

        susanCenterVal.textContent = centerVal;
        susanSimilarCount.textContent = parseFloat(similarCount).toFixed(1);

        // 색상 및 판정 (수업 자료 Slide 13 기준: 0-40% Corner, 40-60% Edge, 80-100% Uniform)
        if (ratio >= 80) {
            susanRatioBar.style.background = 'linear-gradient(to right, #3b82f6, #60a5fa)';
            susanVerdict.textContent = '📐 균일 영역 (Uniform) — 특징점 아님';
            susanVerdict.style.borderColor = '#3b82f6';
            susanVerdict.style.color = '#60a5fa';
        } else if (ratio >= 40) {
            // 40-60%를 Edge로 정의하나, 60-80% 구간도 에지 경계로 간주
            const isStrictEdge = ratio <= 60;
            susanRatioBar.style.background = isStrictEdge 
                ? 'linear-gradient(to right, #eab308, #fde047)'
                : 'linear-gradient(to right, #94a3b8, #cbd5e1)';
            susanVerdict.textContent = isStrictEdge 
                ? '📏 에지 (Edge) — 한 방향으로만 변화'
                : '➖ 에지 경계 — 변화가 완만함';
            susanVerdict.style.borderColor = isStrictEdge ? '#eab308' : '#94a3b8';
            susanVerdict.style.color = isStrictEdge ? '#fde047' : '#cbd5e1';
        } else {
            susanRatioBar.style.background = 'linear-gradient(to right, #ef4444, #fca5a5)';
            susanVerdict.textContent = '🔺 코너 후보 (Corner) — 특징점!';
            susanVerdict.style.borderColor = '#ef4444';
            susanVerdict.style.color = '#fca5a5';
        }
    }

    // 마우스 이동 이벤트
    susanCanvas.addEventListener('mousemove', (e) => {
        const rect = susanCanvas.getBoundingClientRect();
        const scaleX = susanCanvas.width / rect.width;
        const scaleY = susanCanvas.height / rect.height;
        const mx = Math.floor((e.clientX - rect.left) * scaleX / SUSAN_CELL_SIZE);
        const my = Math.floor((e.clientY - rect.top) * scaleY / SUSAN_CELL_SIZE);

        if (mx >= 0 && mx < SUSAN_GRID_SIZE && my >= 0 && my < SUSAN_GRID_SIZE) {
            drawSusanGrid(mx, my);
        }
    });

    susanCanvas.addEventListener('mouseleave', () => {
        drawSusanGrid(-1, -1);
        susanRatioText.textContent = '0%';
        susanRatioBar.style.width = '0%';
        susanVerdict.textContent = '마우스를 격자 위에 올려보세요';
        susanVerdict.style.borderColor = 'var(--border)';
        susanVerdict.style.color = 'var(--text-muted)';
        susanSimilarCount.textContent = '0';
        susanCenterVal.textContent = '-';
        susanMaskCtx.clearRect(0, 0, susanMaskView.width, susanMaskView.height);
    });

    // 임계값 슬라이더
    susanThresholdSlider.addEventListener('input', () => {
        susanThresholdVal.textContent = susanThresholdSlider.value;
    });

    // 전체 코너 검출 버튼
    susanDetectBtn.addEventListener('click', () => {
        const t = parseInt(susanThresholdSlider.value);
        susanDetectedCorners = [];
        const geoThreshold = SUSAN_MASK.length * 0.5; // 기하학적 임계값 (g)

        for (let y = 4; y < SUSAN_GRID_SIZE - 4; y++) {
            for (let x = 4; x < SUSAN_GRID_SIZE - 4; x++) {
                const centerVal = susanGrid[y][x];
                let n = 0;

                SUSAN_MASK.forEach(([dx, dy]) => {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx < 0 || nx >= SUSAN_GRID_SIZE || ny < 0 || ny >= SUSAN_GRID_SIZE) return;
                    const diff = susanGrid[ny][nx] - centerVal;
                    n += Math.exp(-Math.pow(diff / t, 6));
                });

                if (n < geoThreshold) {
                    // 간단한 NMS (3x3)
                    let isMin = true;
                    for (let dy = -1; dy <= 1 && isMin; dy++) {
                        for (let dx = -1; dx <= 1 && isMin; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            const nnx = x + dx, nny = y + dy;
                            if (nnx < 4 || nnx >= SUSAN_GRID_SIZE - 4 || nny < 4 || nny >= SUSAN_GRID_SIZE - 4) continue;
                            const nCenter = susanGrid[nny][nnx];
                            let nn = 0;
                            SUSAN_MASK.forEach(([mdx, mdy]) => {
                                const mx2 = nnx + mdx, my2 = nny + mdy;
                                if (mx2 >= 0 && mx2 < SUSAN_GRID_SIZE && my2 >= 0 && my2 < SUSAN_GRID_SIZE) {
                                    const nDiff = susanGrid[my2][mx2] - nCenter;
                                    nn += Math.exp(-Math.pow(nDiff / t, 6));
                                }
                            });
                            if (dy < 0 || (dy === 0 && dx < 0)) {
                                if (nn <= n) isMin = false;
                            } else {
                                if (nn < n) isMin = false;
                            }
                        }
                    }
                    if (isMin) {
                        susanDetectedCorners.push({ x, y, n });
                    }
                }
            }
        }

        drawSusanGrid(-1, -1);
    });

    // 초기화 버튼
    susanResetBtn.addEventListener('click', () => {
        susanDetectedCorners = [];
        drawSusanGrid(-1, -1);
    });

    // 초기 렌더링
    drawSusanGrid(-1, -1);


    /* =====================================================================
       시뮬레이션 3: 비최대 억제 (NMS) 비교
    ===================================================================== */
    const nmsBeforeCanvas = document.getElementById('nms-before-canvas');
    const nmsBeforeCtx = nmsBeforeCanvas.getContext('2d');
    const nmsAfterCanvas = document.getElementById('nms-after-canvas');
    const nmsAfterCtx = nmsAfterCanvas.getContext('2d');

    const nmsPreset = document.getElementById('nms-preset');
    const nmsWindowSlider = document.getElementById('nms-window');
    const nmsWindowVal = document.getElementById('nms-window-val');
    const nmsThresholdSlider = document.getElementById('nms-threshold');
    const nmsThresholdVal = document.getElementById('nms-threshold-val');
    const nmsRunBtn = document.getElementById('nms-run-btn');
    const nmsBeforeCount = document.getElementById('nms-before-count');
    const nmsAfterCount = document.getElementById('nms-after-count');
    const nmsStatus = document.getElementById('nms-status');

    nmsWindowSlider.addEventListener('input', () => {
        nmsWindowVal.textContent = nmsWindowSlider.value + '×' + nmsWindowSlider.value;
        updateNmsFromCache();
    });
    nmsThresholdSlider.addEventListener('input', () => {
        nmsThresholdVal.textContent = nmsThresholdSlider.value + '%';
        updateNmsFromCache();
    });

    function nonMaxSuppression(R, w, h, windowSize, threshold) {
        const half = Math.floor(windowSize / 2);
        const before = [];
        const after = [];

        for (let y = 2; y < h - 2; y++) {
            for (let x = 2; x < w - 2; x++) {
                if (R[y * w + x] > threshold) {
                    before.push({ x, y, r: R[y * w + x] });
                }
            }
        }

        for (let y = half; y < h - half; y++) {
            for (let x = half; x < w - half; x++) {
                const val = R[y * w + x];
                if (val <= threshold) continue;

                let isMax = true;
                for (let dy = -half; dy <= half && isMax; dy++) {
                    for (let dx = -half; dx <= half && isMax; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        const neighborVal = R[(y + dy) * w + (x + dx)];
                        if (dy < 0 || (dy === 0 && dx < 0)) {
                            if (neighborVal >= val) isMax = false;
                        } else {
                            if (neighborVal > val) isMax = false;
                        }
                    }
                }

                if (isMax) {
                    after.push({ x, y, r: val });
                }
            }
        }

        return { before, after };
    }

    function drawNmsResult(ctx, canvas, grayImg, corners, cornerColor) {
        const SIZE = grayImg.length;
        const cw = canvas.width;
        const ch = canvas.height;

        drawGrayImage(ctx, grayImg, cw, ch);

        const scaleX = cw / SIZE;
        const scaleY = ch / SIZE;

        // 격자선 그리기 (픽셀 경계 표시)
        ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
        ctx.lineWidth = 0.5;
        for (let x = 0; x <= SIZE; x++) {
            ctx.beginPath();
            ctx.moveTo(x * scaleX, 0);
            ctx.lineTo(x * scaleX, ch);
            ctx.stroke();
        }
        for (let y = 0; y <= SIZE; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * scaleY);
            ctx.lineTo(cw, y * scaleY);
            ctx.stroke();
        }

        corners.forEach(pt => {
            ctx.beginPath();
            ctx.arc(pt.x * scaleX + scaleX / 2, pt.y * scaleY + scaleY / 2, 4, 0, Math.PI * 2);
            ctx.fillStyle = cornerColor;
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();
        });
    }

    // NMS 결과 캐시 (마우스 hover 시 다시 그리기 위해)
    let nmsCache = {
        grayImg: null,
        before: [],
        after: [],
        R: null,
        maxR: 0,
        threshold: 0,
        SIZE: 80
    };

    /**
     * 캐시된 R값으로 슬라이더 변경 시 즉시 NMS 재계산
     * 해리스 재연산 없이 임계값/윈도우만 변경하여 빠르게 결과 갱신
     */
    function updateNmsFromCache() {
        if (!nmsCache.R) return; // 아직 실행 안 했으면 무시

        const windowSize = parseInt(nmsWindowSlider.value);
        const threshPercent = parseInt(nmsThresholdSlider.value);
        const SIZE = nmsCache.SIZE;
        const R = nmsCache.R;
        const maxR = nmsCache.maxR;

        const threshold = maxR * (threshPercent / 100);
        const { before, after } = nonMaxSuppression(R, SIZE, SIZE, windowSize, threshold);

        // 캐시 갱신
        nmsCache.before = before;
        nmsCache.after = after;
        nmsCache.threshold = threshold;

        drawNmsResult(nmsBeforeCtx, nmsBeforeCanvas, nmsCache.grayImg, before, 'rgba(239, 68, 68, 0.7)');
        drawNmsResult(nmsAfterCtx, nmsAfterCanvas, nmsCache.grayImg, after, 'rgba(16, 185, 129, 0.9)');

        nmsBeforeCount.textContent = before.length;
        nmsAfterCount.textContent = after.length;

        const reduction = before.length > 0 ? ((1 - after.length / before.length) * 100).toFixed(1) : 0;
        nmsStatus.innerHTML = `<strong>비교 완료!</strong> 임계값만 적용: <span style="color:#ef4444;">${before.length}개</span> → NMS(${windowSize}×${windowSize}) 적용 후: <span style="color:#10b981;">${after.length}개</span> | 감소율: <span style="color:#a78bfa; font-weight:700;">${reduction}%</span>`;
    }

    nmsRunBtn.addEventListener('click', () => {
        nmsRunBtn.textContent = '계산 중...';
        nmsRunBtn.disabled = true;

        setTimeout(() => {
            const preset = nmsPreset.value;
            const windowSize = parseInt(nmsWindowSlider.value);
            const threshPercent = parseInt(nmsThresholdSlider.value);

            const SIZE = 80; // 저해상도: 픽셀이 보이면서 알고리즘 정상 동작
            const grayImg = generatePreset(preset, SIZE);

            const harrisResult = harrisCornerDetection(grayImg, 0.04, 1.4, threshPercent);
            const R = harrisResult.R;
            const maxR = harrisResult.maxR;

            const threshold = maxR * (threshPercent / 100);
            const { before, after } = nonMaxSuppression(R, SIZE, SIZE, windowSize, threshold);

            // 캐시 저장 (R값, 임계값 포함)
            nmsCache = { grayImg, before, after, R, maxR, threshold, SIZE };

            drawNmsResult(nmsBeforeCtx, nmsBeforeCanvas, grayImg, before, 'rgba(239, 68, 68, 0.7)');
            drawNmsResult(nmsAfterCtx, nmsAfterCanvas, grayImg, after, 'rgba(16, 185, 129, 0.9)');

            nmsBeforeCount.textContent = before.length;
            nmsAfterCount.textContent = after.length;

            const reduction = before.length > 0 ? ((1 - after.length / before.length) * 100).toFixed(1) : 0;
            nmsStatus.innerHTML = `<strong>비교 완료!</strong> 임계값만 적용: <span style="color:#ef4444;">${before.length}개</span> → NMS(${windowSize}×${windowSize}) 적용 후: <span style="color:#10b981;">${after.length}개</span> | 감소율: <span style="color:#a78bfa; font-weight:700;">${reduction}%</span>`;

            nmsRunBtn.textContent = '비교 실행';
            nmsRunBtn.disabled = false;
        }, 50);
    });

    const initNms = () => {
        const preset = nmsPreset.value;
        const initImg = generatePreset(preset, 80);
        nmsCache = { grayImg: initImg, before: [], after: [], R: null, maxR: 0, threshold: 0, SIZE: 80 };
        drawNmsResult(nmsBeforeCtx, nmsBeforeCanvas, initImg, [], 'rgba(239, 68, 68, 0.7)');
        drawNmsResult(nmsAfterCtx, nmsAfterCanvas, initImg, [], 'rgba(16, 185, 129, 0.9)');
        nmsBeforeCount.textContent = '0';
        nmsAfterCount.textContent = '0';
    };

    initNms();
    nmsPreset.addEventListener('change', initNms);

    /**
     * NMS 캔버스 위에 윈도우 크기 + R값/임계값 오버레이 표시
     */
    function drawNmsWindowOverlay(canvas, ctx, e, corners, cornerColor) {
        if (!nmsCache.grayImg) return;

        const rect = canvas.getBoundingClientRect();
        const scaleCanvasX = canvas.width / rect.width;
        const scaleCanvasY = canvas.height / rect.height;
        const mouseCanvasX = (e.clientX - rect.left) * scaleCanvasX;
        const mouseCanvasY = (e.clientY - rect.top) * scaleCanvasY;

        const SIZE = nmsCache.SIZE;
        const pixelW = canvas.width / SIZE;
        const pixelH = canvas.height / SIZE;

        // 마우스가 가리키는 픽셀 좌표
        const px = Math.floor(mouseCanvasX / pixelW);
        const py = Math.floor(mouseCanvasY / pixelH);

        if (px < 0 || px >= SIZE || py < 0 || py >= SIZE) return;

        // 기존 결과 다시 렌더링
        drawNmsResult(ctx, canvas, nmsCache.grayImg, corners, cornerColor);

        const windowSize = parseInt(nmsWindowSlider.value);
        const half = Math.floor(windowSize / 2);
        const R = nmsCache.R;
        const maxR = nmsCache.maxR;
        const threshold = nmsCache.threshold;

        // 윈도우 범위 계산 (클램핑)
        const x1 = Math.max(0, px - half);
        const y1 = Math.max(0, py - half);
        const x2 = Math.min(SIZE - 1, px + half);
        const y2 = Math.min(SIZE - 1, py + half);

        // R값이 있으면 윈도우 내 픽셀별 R값 시각화
        if (R) {
            for (let wy = y1; wy <= y2; wy++) {
                for (let wx = x1; wx <= x2; wx++) {
                    const rVal = R[wy * SIZE + wx];
                    if (rVal > threshold) {
                        // 임계값 초과: 노란색 오버레이 (R값 클수록 진하게)
                        const intensity = Math.min(1, rVal / maxR);
                        ctx.fillStyle = `rgba(250, 204, 21, ${0.15 + intensity * 0.35})`;
                    } else if (rVal > 0) {
                        // 양수이지만 임계값 미달: 어두운 오버레이
                        ctx.fillStyle = 'rgba(100, 100, 100, 0.2)';
                    } else {
                        // 음수 (에지/평면): 파란 오버레이
                        ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
                    }
                    ctx.fillRect(wx * pixelW, wy * pixelH, pixelW, pixelH);
                }
            }
        } else {
            // R값 없으면 기존 단색 오버레이
            ctx.fillStyle = 'rgba(139, 92, 246, 0.15)';
            ctx.fillRect(x1 * pixelW, y1 * pixelH, (x2 - x1 + 1) * pixelW, (y2 - y1 + 1) * pixelH);
        }

        // 윈도우 테두리
        ctx.strokeStyle = '#a78bfa';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(x1 * pixelW, y1 * pixelH, (x2 - x1 + 1) * pixelW, (y2 - y1 + 1) * pixelH);
        ctx.setLineDash([]);

        // 중심 픽셀 강조
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(px * pixelW, py * pixelH, pixelW, pixelH);

        // 정보 말풍선 그리기 (R값, 임계값 비교)
        if (R) {
            const rVal = R[py * SIZE + px];
            const aboveThreshold = rVal > threshold;

            // 윈도우 내 최대값 찾기
            let windowMax = -Infinity;
            let windowMaxX = px, windowMaxY = py;
            for (let wy = y1; wy <= y2; wy++) {
                for (let wx = x1; wx <= x2; wx++) {
                    if (R[wy * SIZE + wx] > windowMax) {
                        windowMax = R[wy * SIZE + wx];
                        windowMaxX = wx;
                        windowMaxY = wy;
                    }
                }
            }
            const isLocalMax = (px === windowMaxX && py === windowMaxY);

            // 윈도우 내 최대값 픽셀에 별 표시
            if (windowMax > threshold) {
                ctx.fillStyle = '#fbbf24';
                ctx.font = 'bold 14px Inter';
                ctx.textAlign = 'center';
                ctx.fillText('★', windowMaxX * pixelW + pixelW / 2, windowMaxY * pixelH + pixelH / 2 + 5);
            }

            // 말풍선 위치 계산 (윈도우 영역을 가리지 않도록 바깥에 배치)
            const tooltipW = 185;
            const tooltipH = 62;
            const winLeft = x1 * pixelW;
            const winRight = (x2 + 1) * pixelW;
            const winTop = y1 * pixelH;
            const winBottom = (y2 + 1) * pixelH;

            let tx, ty;
            if (winRight + tooltipW + 6 <= canvas.width) {
                // 윈도우 오른쪽에 배치
                tx = winRight + 6;
                ty = winTop;
            } else if (winLeft - tooltipW - 6 >= 0) {
                // 윈도우 왼쪽에 배치
                tx = winLeft - tooltipW - 6;
                ty = winTop;
            } else if (winTop - tooltipH - 6 >= 0) {
                // 윈도우 위에 배치
                tx = winLeft;
                ty = winTop - tooltipH - 6;
            } else {
                // 윈도우 아래에 배치
                tx = winLeft;
                ty = winBottom + 6;
            }
            // 캔버스 경계 클램핑
            tx = Math.max(2, Math.min(canvas.width - tooltipW - 2, tx));
            ty = Math.max(2, Math.min(canvas.height - tooltipH - 2, ty));

            // 말풍선 배경
            ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
            ctx.beginPath();
            const radius = 6;
            ctx.moveTo(tx + radius, ty);
            ctx.lineTo(tx + tooltipW - radius, ty);
            ctx.arcTo(tx + tooltipW, ty, tx + tooltipW, ty + radius, radius);
            ctx.lineTo(tx + tooltipW, ty + tooltipH - radius);
            ctx.arcTo(tx + tooltipW, ty + tooltipH, tx + tooltipW - radius, ty + tooltipH, radius);
            ctx.lineTo(tx + radius, ty + tooltipH);
            ctx.arcTo(tx, ty + tooltipH, tx, ty + tooltipH - radius, radius);
            ctx.lineTo(tx, ty + radius);
            ctx.arcTo(tx, ty, tx + radius, ty, radius);
            ctx.fill();
            ctx.strokeStyle = aboveThreshold ? '#fbbf24' : '#475569';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([]);
            ctx.stroke();

            // R값을 maxR 대비 정규화 (0~100%)
            const rPercent = maxR > 0 ? (rVal / maxR * 100) : 0;
            const threshPercent = maxR > 0 ? (threshold / maxR * 100) : 0;

            ctx.textAlign = 'left';
            ctx.font = '11px Inter, Noto Sans KR';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText(`R값:`, tx + 8, ty + 16);
            ctx.fillStyle = aboveThreshold ? '#fbbf24' : '#ef4444';
            ctx.font = 'bold 11px monospace';
            ctx.fillText(`${rPercent.toFixed(1)}%`, tx + 40, ty + 16);
            ctx.fillStyle = '#94a3b8';
            ctx.font = '11px Inter, Noto Sans KR';
            ctx.fillText(`임계값:`, tx + 8, ty + 32);
            ctx.fillStyle = '#a78bfa';
            ctx.font = 'bold 11px monospace';
            ctx.fillText(`${threshPercent.toFixed(1)}%`, tx + 55, ty + 32);

            // 판정 결과
            ctx.font = 'bold 11px Inter, Noto Sans KR';
            if (aboveThreshold && isLocalMax) {
                ctx.fillStyle = '#10b981';
                ctx.fillText('✓ 임계값↑ + 지역최대 → 코너!', tx + 8, ty + 52);
            } else if (aboveThreshold) {
                ctx.fillStyle = '#fbbf24';
                ctx.fillText('△ 임계값↑ 이지만 지역최대✗', tx + 8, ty + 52);
            } else {
                ctx.fillStyle = '#64748b';
                ctx.fillText('✗ 임계값 미달 → 억제됨', tx + 8, ty + 52);
            }
            ctx.textAlign = 'start';
        }

        // 윈도우 크기 라벨
        ctx.fillStyle = '#a78bfa';
        ctx.font = 'bold 12px Inter, Noto Sans KR';
        ctx.textAlign = 'center';
        const labelX = (x1 + x2 + 1) / 2 * pixelW;
        const labelY = y1 * pixelH - 5;
        ctx.fillText(`${windowSize}×${windowSize}`, labelX, labelY > 14 ? labelY : (y2 + 1) * pixelH + 14);
        ctx.textAlign = 'start';
    }

    // NMS Before 캔버스 마우스 이벤트
    nmsBeforeCanvas.addEventListener('mousemove', (e) => {
        drawNmsWindowOverlay(nmsBeforeCanvas, nmsBeforeCtx, e, nmsCache.before, 'rgba(239, 68, 68, 0.7)');
    });
    nmsBeforeCanvas.addEventListener('mouseleave', () => {
        if (nmsCache.grayImg) {
            drawNmsResult(nmsBeforeCtx, nmsBeforeCanvas, nmsCache.grayImg, nmsCache.before, 'rgba(239, 68, 68, 0.7)');
        }
    });

    // NMS After 캔버스 마우스 이벤트
    nmsAfterCanvas.addEventListener('mousemove', (e) => {
        drawNmsWindowOverlay(nmsAfterCanvas, nmsAfterCtx, e, nmsCache.after, 'rgba(16, 185, 129, 0.9)');
    });
    nmsAfterCanvas.addEventListener('mouseleave', () => {
        if (nmsCache.grayImg) {
            drawNmsResult(nmsAfterCtx, nmsAfterCanvas, nmsCache.grayImg, nmsCache.after, 'rgba(16, 185, 129, 0.9)');
        }
    });

});
