document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('mainCanvas');
    const ctx = canvas.getContext('2d');
    
    const networkCanvas = document.getElementById('networkCanvas');
    const netCtx = networkCanvas.getContext('2d');
    
    // UI Elements
    const lrSlider = document.getElementById('learningRate');
    const lrValue = document.getElementById('lrValue');
    const hiddenNodesSlider = document.getElementById('hiddenNodes');
    const hiddenNodesValue = document.getElementById('hiddenNodesValue');
    const epochText = document.getElementById('epochText');
    const lossText = document.getElementById('lossText');
    const trainBtn = document.getElementById('trainBtn');
    const autoTrainBtn = document.getElementById('autoTrainBtn');
    const resetBtn = document.getElementById('resetBtn');
    const datasetSelect = document.getElementById('datasetSelect');
    const canvasTitle = document.getElementById('canvasTitle');

    // 데이터 셋
    const allDatasets = {
        xor: [
            { x: [0, 0], y: 0 },
            { x: [0, 1], y: 1 },
            { x: [1, 0], y: 1 },
            { x: [1, 1], y: 0 }
        ],
        or: [
            { x: [0, 0], y: 0 },
            { x: [0, 1], y: 1 },
            { x: [1, 0], y: 1 },
            { x: [1, 1], y: 1 }
        ],
        and: [
            { x: [0, 0], y: 0 },
            { x: [0, 1], y: 0 },
            { x: [1, 0], y: 0 },
            { x: [1, 1], y: 1 }
        ]
    };
    
    let currentDatasetKey = 'xor';
    let dataset = allDatasets[currentDatasetKey];

    // 신경망 모델 변수
    let inputNodes = 2;
    let hiddenNodes = 4;
    let outputNodes = 1;
    
    let w_ih = []; // 입력-은닉 가중치
    let b_h = [];  // 은닉 편향
    let w_ho = []; // 은닉-출력 가중치
    let b_o = [];  // 출력 편향
    let w_io = []; // 단일 퍼셉트론용 입력-출력 다이렉트 가중치

    let epoch = 0;
    let isAutoTraining = false;
    let animationId = null;

    // 시그모이드 활성화 함수 및 미분
    function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
    function d_sigmoid(y) { return y * (1 - y); } // y는 이미 활성화된 값

    // 초기화
    function initNetwork() {
        hiddenNodes = parseInt(hiddenNodesSlider.value);
        
        if (hiddenNodes > 0) {
            // 다층 퍼셉트론 가중치 초기화
            w_ih = Array.from({length: hiddenNodes}, () => Array.from({length: inputNodes}, () => Math.random() * 2 - 1));
            b_h = Array.from({length: hiddenNodes}, () => Math.random() * 2 - 1);
            
            w_ho = Array.from({length: outputNodes}, () => Array.from({length: hiddenNodes}, () => Math.random() * 2 - 1));
            b_o = Array.from({length: outputNodes}, () => Math.random() * 2 - 1);
        } else {
            // 단일 퍼셉트론 (은닉층 없음) 가중치 초기화
            w_ih = []; b_h = []; w_ho = [];
            w_io = Array.from({length: outputNodes}, () => Array.from({length: inputNodes}, () => Math.random() * 2 - 1));
            b_o = Array.from({length: outputNodes}, () => Math.random() * 2 - 1);
        }

        epoch = 0;
        updateUI();
        drawCanvas();
    }

    // 순전파 (Forward)
    function forward(input) {
        if (hiddenNodes === 0) {
            let o = new Array(outputNodes);
            for(let i=0; i<outputNodes; i++) {
                let sum = b_o[i];
                for(let j=0; j<inputNodes; j++) {
                    sum += w_io[i][j] * input[j];
                }
                o[i] = sigmoid(sum);
            }
            return { h: [], o };
        }

        let h = new Array(hiddenNodes);
        for(let i=0; i<hiddenNodes; i++) {
            let sum = b_h[i];
            for(let j=0; j<inputNodes; j++) {
                sum += w_ih[i][j] * input[j];
            }
            h[i] = sigmoid(sum);
        }

        let o = new Array(outputNodes);
        for(let i=0; i<outputNodes; i++) {
            let sum = b_o[i];
            for(let j=0; j<hiddenNodes; j++) {
                sum += w_ho[i][j] * h[j];
            }
            o[i] = sigmoid(sum);
        }

        return { h, o };
    }

    // 역전파 및 학습 1회 수행
    function trainStep() {
        const lr = parseFloat(lrSlider.value);
        let totalLoss = 0;

        // 확률적 경사하강법(SGD)을 위해 데이터 셔플
        const shuffledData = [...dataset].sort(() => Math.random() - 0.5);

        for(let d=0; d<shuffledData.length; d++) {
            const input = shuffledData[d].x;
            const target = shuffledData[d].y;

            // 1. Forward
            const { h, o } = forward(input);
            const output = o[0];

            // Loss 계산 (MSE)
            const error = output - target;
            totalLoss += 0.5 * error * error;

            // 2. Backward (출력층)
            // dO = (output - target) * sigmoid_derivative(output)
            const dO = error * d_sigmoid(output);

            if (hiddenNodes === 0) {
                // 단일 퍼셉트론 업데이트
                for(let j=0; j<inputNodes; j++) {
                    w_io[0][j] -= lr * dO * input[j];
                }
                b_o[0] -= lr * dO;
            } else {
                // 3. Backward (은닉층)
                let dH = new Array(hiddenNodes);
                for(let i=0; i<hiddenNodes; i++) {
                    dH[i] = (dO * w_ho[0][i]) * d_sigmoid(h[i]);
                }

                // 4. Update Weights
                // 은닉-출력 업데이트
                for(let i=0; i<hiddenNodes; i++) {
                    w_ho[0][i] -= lr * dO * h[i];
                }
                b_o[0] -= lr * dO;

                // 입력-은닉 업데이트
                for(let i=0; i<hiddenNodes; i++) {
                    for(let j=0; j<inputNodes; j++) {
                        w_ih[i][j] -= lr * dH[i] * input[j];
                    }
                    b_h[i] -= lr * dH[i];
                }
            }
        }

        epoch++;
        return totalLoss / dataset.length;
    }

    function trainEpochs(numEpochs) {
        let lastLoss = 0;
        for(let i=0; i<numEpochs; i++) {
            lastLoss = trainStep();
        }
        lossText.textContent = lastLoss.toFixed(6);
        updateUI();
        drawCanvas();
    }

    function autoTrainLoop() {
        if (!isAutoTraining) return;
        trainEpochs(5); // 한 번에 5번씩 학습하여 시각적 확인이 쉽도록 속도 조절
        animationId = requestAnimationFrame(autoTrainLoop);
    }

    // 신경망 구조 그리기 (다이어그램)
    function drawNetwork() {
        if (hiddenNodes > 0 && (!w_ih || w_ih.length === 0)) return;
        if (hiddenNodes === 0 && (!w_io || w_io.length === 0)) return;

        const width = networkCanvas.width;
        const height = networkCanvas.height;
        netCtx.clearRect(0, 0, width, height);

        const isSingleLayer = (hiddenNodes === 0);
        const layerX = isSingleLayer ? [width * 0.3, 0, width * 0.7] : [width * 0.2, width * 0.5, width * 0.8];
        
        // 노드 좌표 계산
        const inputPos = [
            { x: layerX[0], y: height * 0.33 },
            { x: layerX[0], y: height * 0.66 }
        ];
        const inputBiasPos = { x: layerX[0], y: height * 0.88 }; // 바이어스 노드

        const hiddenPos = [];
        let hiddenBiasPos = null;
        
        if (!isSingleLayer) {
            const startY = height * 0.15;
            const endY = height * 0.75;
            
            for(let i=0; i<hiddenNodes; i++) {
                let yPos = hiddenNodes === 1 ? (startY + endY) / 2 : startY + (endY - startY) * (i / (hiddenNodes - 1));
                hiddenPos.push({ x: layerX[1], y: yPos });
            }
            hiddenBiasPos = { x: layerX[1], y: height * 0.88 }; // 은닉층 바이어스
        }

        const outputPos = [{ x: layerX[2], y: height * 0.5 }];

        // 선 그리기 함수
        const drawEdge = (p1, p2, weight, isBias = false) => {
            netCtx.beginPath();
            netCtx.moveTo(p1.x, p1.y);
            netCtx.lineTo(p2.x, p2.y);
            // 가중치 값에 따른 색상 및 두께 설정
            const absW = Math.abs(weight);
            const thickness = Math.max(0.5, Math.min(absW * 3, 8)); // 최소 0.5, 최대 8
            netCtx.lineWidth = thickness;
            
            if (isBias) {
                netCtx.setLineDash([5, 5]); // 바이어스 선은 점선
            } else {
                netCtx.setLineDash([]);
            }

            // 양수면 파란색, 음수면 빨간색 (알파값 조절)
            const alpha = Math.max(0.2, Math.min(absW * 0.5, 0.9));
            netCtx.strokeStyle = weight > 0 ? `rgba(41, 121, 255, ${alpha})` : `rgba(255, 61, 0, ${alpha})`;
            netCtx.stroke();
            netCtx.setLineDash([]); // 복구
        };

        if (isSingleLayer) {
            // 단일 퍼셉트론: 입력 -> 출력
            for(let j=0; j<inputNodes; j++) {
                drawEdge(inputPos[j], outputPos[0], w_io[0][j]);
            }
            drawEdge(inputBiasPos, outputPos[0], b_o[0], true);
        } else {
            // 입력 -> 은닉 가중치 선 그리기
            for(let i=0; i<hiddenNodes; i++) {
                for(let j=0; j<inputNodes; j++) {
                    drawEdge(inputPos[j], hiddenPos[i], w_ih[i][j]);
                }
                drawEdge(inputBiasPos, hiddenPos[i], b_h[i], true);
            }

            // 은닉 -> 출력 가중치 선 그리기
            for(let i=0; i<hiddenNodes; i++) {
                drawEdge(hiddenPos[i], outputPos[0], w_ho[0][i]);
            }
            drawEdge(hiddenBiasPos, outputPos[0], b_o[0], true);
        }

        // 노드 그리기 함수
        const drawNode = (p, label, color, isBias = false) => {
            netCtx.beginPath();
            netCtx.arc(p.x, p.y, 14, 0, Math.PI * 2);
            netCtx.fillStyle = isBias ? '#1e293b' : '#0a192f'; // 바이어스 노드는 약간 밝은 배경
            netCtx.fill();
            netCtx.lineWidth = 2;
            netCtx.strokeStyle = color;
            netCtx.stroke();
            
            // 텍스트 라벨
            netCtx.fillStyle = '#fff';
            netCtx.font = isBias ? '10px Arial' : '12px Arial';
            netCtx.textAlign = 'center';
            netCtx.textBaseline = 'middle';
            netCtx.fillText(label, p.x, p.y);
        };

        // 노드들 그리기
        inputPos.forEach((p, i) => drawNode(p, `X${i+1}`, '#a8b2d1'));
        drawNode(inputBiasPos, '+1', '#ffb74d', true); // 입력 바이어스
        
        if (!isSingleLayer) {
            hiddenPos.forEach((p, i) => drawNode(p, `H${i+1}`, '#64ffda'));
            drawNode(hiddenBiasPos, '+1', '#ffb74d', true); // 은닉 바이어스
        }
        
        outputPos.forEach((p, i) => drawNode(p, `O`, '#ff6464'));

        // 각 층 라벨 텍스트 그리기
        netCtx.fillStyle = '#cbd5e1';
        netCtx.font = '14px Arial';
        netCtx.textAlign = 'center';
        netCtx.textBaseline = 'top';
        const labelY = height * 0.05; // 상단 여백
        
        netCtx.fillText("입력층", layerX[0], labelY);
        if (!isSingleLayer) {
            netCtx.fillText("은닉층", layerX[1], labelY);
        }
        netCtx.fillText("출력층", layerX[2], labelY);
    }

    // 캔버스 그리기 (결정 경계 시각화)
    function drawCanvas() {
        if (hiddenNodes > 0 && (!w_ih || w_ih.length === 0)) return;
        if (hiddenNodes === 0 && (!w_io || w_io.length === 0)) return;

        const width = canvas.width;
        const height = canvas.height;
        const res = 10; // 해상도 (그리드 크기)

        ctx.clearRect(0, 0, width, height);
        drawNetwork(); // 네트워크 다이어그램 업데이트

        // 시각화 영역: x, y는 -0.2 ~ 1.2
        const mapToGrid = (px) => (px / width) * 1.4 - 0.2;
        const mapToScreenX = (val) => ((val + 0.2) / 1.4) * width;
        const mapToScreenY = (val) => (1 - (val + 0.2) / 1.4) * height; // Y축 반전

        // 1. 배경 결정 영역 그리기
        for (let x = 0; x < width; x += res) {
            for (let y = 0; y < height; y += res) {
                // 픽셀을 모델 입력값으로 변환
                const valX = mapToGrid(x);
                const valY = mapToGrid(height - y); // Y 반전

                const result = forward([valX, valY]).o[0];
                
                // 결과값(0~1)에 따라 색상 보간 (0: 주황색 #ff9800, 1: 초록색 #00e676)
                const r = Math.floor((1 - result) * 255 + result * 0);
                const g = Math.floor((1 - result) * 152 + result * 230);
                const b = Math.floor((1 - result) * 0 + result * 118);
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.5)`;
                ctx.fillRect(x, y, res, res);
            }
        }

        // 2. XOR 데이터 점 그리기
        dataset.forEach(d => {
            const sx = mapToScreenX(d.x[0]);
            const sy = mapToScreenY(d.x[1]);

            // 1. 점 그리기
            ctx.beginPath();
            if (d.y === 0) {
                // 0은 주황 원
                ctx.arc(sx, sy, 10, 0, Math.PI * 2);
                ctx.fillStyle = '#ff9800';
            } else {
                // 1은 초록 사각형
                ctx.rect(sx - 10, sy - 10, 20, 20);
                ctx.fillStyle = '#00e676';
            }
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.closePath();

            // 2. 좌표 텍스트 그리기
            ctx.font = 'bold 13px Arial';
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 4;
            // 점의 위치에 따라 텍스트 위치 조정 (기본적으로 점 위쪽)
            ctx.fillText(`${d.x[0]}, ${d.x[1]}`, sx, sy - 18);
            ctx.shadowBlur = 0; // 그림자 효과 초기화
        });
    }

    function updateUI() {
        epochText.textContent = epoch;
    }

    function resizeCanvas() {
        canvas.width = 0;
        canvas.height = 0;
        networkCanvas.width = 0;
        networkCanvas.height = 0;
        
        const wrapper = canvas.parentElement;
        canvas.width = wrapper.clientWidth;
        canvas.height = wrapper.clientHeight;
        
        const netWrapper = networkCanvas.parentElement;
        networkCanvas.width = netWrapper.clientWidth;
        networkCanvas.height = netWrapper.clientHeight;
        
        drawCanvas();
    }

    // UI Event Listeners
    datasetSelect.addEventListener('change', (e) => {
        currentDatasetKey = e.target.value;
        dataset = allDatasets[currentDatasetKey];
        const titleText = e.target.options[e.target.selectedIndex].text;
        canvasTitle.textContent = `주황색(0)과 초록색(1) 데이터의 ${titleText} 분류 공간`;
        
        if (isAutoTraining) autoTrainBtn.click(); // 학습 중지
        initNetwork();
    });

    lrSlider.addEventListener('input', (e) => { lrValue.textContent = e.target.value; });
    hiddenNodesSlider.addEventListener('input', (e) => { 
        hiddenNodesValue.textContent = e.target.value;
        initNetwork(); // 구조가 바뀌면 초기화
    });

    trainBtn.addEventListener('click', () => { trainEpochs(100); });
    
    autoTrainBtn.addEventListener('click', () => {
        isAutoTraining = !isAutoTraining;
        if (isAutoTraining) {
            autoTrainBtn.textContent = '자동 학습 중지';
            autoTrainBtn.classList.add('danger-btn');
            autoTrainBtn.classList.remove('action-btn');
            autoTrainLoop();
        } else {
            autoTrainBtn.textContent = '자동 학습 시작';
            autoTrainBtn.classList.add('action-btn');
            autoTrainBtn.classList.remove('danger-btn');
            cancelAnimationFrame(animationId);
        }
    });

    resetBtn.addEventListener('click', () => {
        if(isAutoTraining) autoTrainBtn.click(); // 중지
        initNetwork();
    });

    // 화면 리사이즈
    window.addEventListener('resize', resizeCanvas);

    // 초기 실행
    initNetwork();
    setTimeout(() => {
        resizeCanvas();
    }, 100);
});
