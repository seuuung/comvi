document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('mainCanvas');
    const ctx = canvas.getContext('2d');
    
    let points = [];
    let lsqLine = null;
    let ransacLine = null;
    let ransacInliers = [];

    // UI Elements
    const outlierRatioSlider = document.getElementById('outlierRatio');
    const outlierRatioValue = document.getElementById('outlierRatioValue');
    const ransacThresholdSlider = document.getElementById('ransacThreshold');
    const ransacThresholdValue = document.getElementById('ransacThresholdValue');
    
    const statusMessage = document.getElementById('statusMessage');
    const lsqResultText = document.getElementById('lsqResult');
    const ransacResultText = document.getElementById('ransacResult');

    // Resize canvas
    function resizeCanvas() {
        canvas.width = 0;
        canvas.height = 0;
        const wrapper = canvas.parentElement;
        canvas.width = wrapper.clientWidth;
        canvas.height = wrapper.clientHeight;
        draw();
    }
    window.addEventListener('resize', resizeCanvas);
    
    // Initial UI Setup
    outlierRatioSlider.addEventListener('input', (e) => {
        outlierRatioValue.textContent = e.target.value + '%';
    });
    ransacThresholdSlider.addEventListener('input', (e) => {
        ransacThresholdValue.textContent = e.target.value;
    });

    // Event Listeners
    canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        // CSS 크기와 캔버스 내부 해상도 비율 보정 (HiDPI 대응)
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        points.push({x, y});
        draw();
    });

    document.getElementById('generateBtn').addEventListener('click', generateData);
    document.getElementById('lsqBtn').addEventListener('click', fitLSQ);
    document.getElementById('ransacBtn').addEventListener('click', fitRANSAC);
    document.getElementById('clearBtn').addEventListener('click', () => {
        points = [];
        lsqLine = null;
        ransacLine = null;
        ransacInliers = [];
        updateStatus("초기화되었습니다.", "대기 중", "대기 중");
        draw();
    });

    // 데이터 무작위 생성
    function generateData() {
        points = [];
        lsqLine = null;
        ransacLine = null;
        ransacInliers = [];

        const totalPoints = 100;
        const outlierRatio = parseInt(outlierRatioSlider.value) / 100;
        const outlierCount = Math.floor(totalPoints * outlierRatio);
        const inlierCount = totalPoints - outlierCount;

        // 임의의 정답 선 (Inlier가 모일 선)
        const angle = Math.random() * Math.PI; // 0 ~ 180도
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);

        // Inlier 생성
        for (let i = 0; i < inlierCount; i++) {
            const t = (Math.random() - 0.5) * Math.min(canvas.width, canvas.height) * 0.8;
            const noiseX = (Math.random() - 0.5) * 15;
            const noiseY = (Math.random() - 0.5) * 15;
            
            points.push({
                x: cx + dx * t + noiseX,
                y: cy + dy * t + noiseY
            });
        }

        // Outlier 생성
        for (let i = 0; i < outlierCount; i++) {
            points.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height
            });
        }

        updateStatus(`${totalPoints}개의 데이터(아웃라이어 ${outlierCount}개)가 생성되었습니다.`, "대기 중", "대기 중");
        draw();
    }

    // 최소제곱법 (Total Least Squares / PCA)
    function fitLSQ() {
        if (points.length < 2) {
            updateStatus("점이 최소 2개 이상 필요합니다.");
            return;
        }

        // 1. 중심(Centroid) 계산
        let sumX = 0, sumY = 0;
        points.forEach(p => { sumX += p.x; sumY += p.y; });
        const cx = sumX / points.length;
        const cy = sumY / points.length;

        // 2. 공분산 행렬 계산
        let covXX = 0, covXY = 0, covYY = 0;
        points.forEach(p => {
            const dx = p.x - cx;
            const dy = p.y - cy;
            covXX += dx * dx;
            covXY += dx * dy;
            covYY += dy * dy;
        });

        // 3. 주성분(고유벡터) 계산
        // 고유값 방정식: lambda^2 - (covXX+covYY)*lambda + (covXX*covYY - covXY^2) = 0
        const trace = covXX + covYY;
        const det = covXX * covYY - covXY * covXY;
        const lambda1 = (trace + Math.sqrt(trace * trace - 4 * det)) / 2; // 가장 큰 고유값

        // 고유벡터 (방향 벡터)
        let dirX, dirY;
        if (covXY !== 0) {
            dirX = lambda1 - covYY;
            dirY = covXY;
        } else {
            dirX = 1; dirY = 0; // 임의 처리
        }

        // 정규화
        const mag = Math.sqrt(dirX*dirX + dirY*dirY);
        if (mag > 0) {
            dirX /= mag;
            dirY /= mag;
        } else {
            dirX = 1; dirY = 0;
        }

        lsqLine = { cx, cy, dirX, dirY };
        lsqResultText.innerHTML = `LSQ: 완료 (모든 데이터를 동등하게 반영)`;
        draw();
    }

    // RANSAC 알고리즘
    function fitRANSAC() {
        if (points.length < 2) {
            updateStatus("점이 최소 2개 이상 필요합니다.");
            return;
        }

        const iterations = 1000;
        const threshold = parseInt(ransacThresholdSlider.value);
        
        let bestInliers = [];
        let bestLine = null;

        for (let i = 0; i < iterations; i++) {
            // 1. 랜덤하게 두 점 선택
            const idx1 = Math.floor(Math.random() * points.length);
            let idx2 = Math.floor(Math.random() * points.length);
            while (idx1 === idx2 && points.length > 1) {
                idx2 = Math.floor(Math.random() * points.length);
            }

            const p1 = points[idx1];
            const p2 = points[idx2];

            // 방향 벡터 계산
            let dirX = p2.x - p1.x;
            let dirY = p2.y - p1.y;
            const mag = Math.sqrt(dirX*dirX + dirY*dirY);
            if (mag === 0) continue;
            dirX /= mag;
            dirY /= mag;

            // 법선 벡터
            const nx = -dirY;
            const ny = dirX;
            // 직선의 방정식: nx*x + ny*y + c = 0
            const c = -(nx * p1.x + ny * p1.y);

            // 2. 모든 점에 대해 Inlier 검사
            let currentInliers = [];
            for (let j = 0; j < points.length; j++) {
                const p = points[j];
                // 점과 직선 사이의 거리: |nx*x + ny*y + c| (nx, ny가 정규화되어 있으므로 분모는 1)
                const dist = Math.abs(nx * p.x + ny * p.y + c);
                if (dist < threshold) {
                    currentInliers.push(p);
                }
            }

            // 3. 최적 모델 갱신
            if (currentInliers.length > bestInliers.length) {
                bestInliers = currentInliers;
                bestLine = { cx: p1.x, cy: p1.y, dirX, dirY };
            }
        }

        // (선택) 최적의 Inlier들로 다시 LSQ 수행하여 선을 다듬기
        if (bestInliers.length > 2) {
            let sumX = 0, sumY = 0;
            bestInliers.forEach(p => { sumX += p.x; sumY += p.y; });
            const cx = sumX / bestInliers.length;
            const cy = sumY / bestInliers.length;

            let covXX = 0, covXY = 0, covYY = 0;
            bestInliers.forEach(p => {
                const dx = p.x - cx;
                const dy = p.y - cy;
                covXX += dx * dx;
                covXY += dx * dy;
                covYY += dy * dy;
            });

            const trace = covXX + covYY;
            const det = covXX * covYY - covXY * covXY;
            const lambda1 = (trace + Math.sqrt(trace * trace - 4 * det)) / 2;
            
            let dirX = lambda1 - covYY;
            let dirY = covXY;
            const mag = Math.sqrt(dirX*dirX + dirY*dirY);
            if (mag > 0) {
                dirX /= mag; dirY /= mag;
            } else {
                dirX = 1; dirY = 0;
            }
            ransacLine = { cx, cy, dirX, dirY };
        } else {
            ransacLine = bestLine;
        }

        ransacInliers = bestInliers;
        ransacResultText.innerHTML = `RANSAC: Inliers ${bestInliers.length}개 찾음`;
        draw();
    }

    // 그리기 함수
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 점 그리기
        points.forEach(p => {
            // RANSAC inlier 여부에 따라 색상 다르게 표시
            const isInlier = ransacInliers.includes(p);
            
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            if (isInlier && ransacLine) {
                ctx.fillStyle = '#00c853'; // RANSAC Inlier: 녹색
            } else {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; // 기본 점
            }
            ctx.fill();
            ctx.closePath();
        });

        // LSQ 선 그리기
        if (lsqLine) {
            drawLine(lsqLine, '#ff3d00', 2, [5, 5]); // 빨간 점선
        }

        // RANSAC 선 그리기
        if (ransacLine) {
            drawLine(ransacLine, '#00c853', 3, []); // 두꺼운 녹색 실선
        }
    }

    function drawLine(lineObj, color, width, dashPattern) {
        const diag = Math.sqrt(canvas.width*canvas.width + canvas.height*canvas.height);
        const p1 = {
            x: lineObj.cx - lineObj.dirX * diag,
            y: lineObj.cy - lineObj.dirY * diag
        };
        const p2 = {
            x: lineObj.cx + lineObj.dirX * diag,
            y: lineObj.cy + lineObj.dirY * diag
        };

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        if (dashPattern.length > 0) {
            ctx.setLineDash(dashPattern);
        }
        ctx.stroke();
        ctx.restore();
    }

    function updateStatus(msg, lsqMsg, ransacMsg) {
        statusMessage.textContent = msg;
        if (lsqMsg !== undefined) lsqResultText.innerHTML = `LSQ: ${lsqMsg}`;
        if (ransacMsg !== undefined) ransacResultText.innerHTML = `RANSAC: ${ransacMsg}`;
    }

    // 초기 크기 설정
    setTimeout(resizeCanvas, 100);
});
