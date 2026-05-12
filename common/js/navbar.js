/**
 * 공통 내비게이션 바 로더
 * 현재 페이지를 자동으로 감지하여 active 클래스를 적용합니다.
 */
function init() {
    // 1. 전체 프로젝트 내비게이션 항목 정의 (주차별 그룹핑)
    const allNavItems = [
        { href: '../5주차/session1.html', text: '5주차 (에지연결/RANSAC)', group: '5주차' },
        { href: '../5주차/session2.html', text: '5주차 (모라벡 코너)', group: '5주차' },
        { href: '../5주차/session3.html', text: '5주차 (해리스/SUSAN)', group: '5주차' },
        { href: '../10주차/session1.html', text: '10주차 1차시 (KD 트리/BBF)', group: '10주차' },
        { href: '../10주차/session2.html', text: '10주차 2차시 (LSQ/RANSAC)', group: '10주차' },
        { href: '../10주차/session3.html', text: '10주차 3차시 (기계학습/MLP)', group: '10주차' }
    ];

    // 2. 현재 경로 감지
    const currentPath = window.location.pathname;
    // URL 디코딩 처리 (한글 폴더명 매칭을 위해)
    const decodedPath = decodeURIComponent(currentPath);

    // 3. 현재 주차 그룹 파악 및 필터링
    let currentGroup = '5주차'; // 기본값
    if (decodedPath.includes('/10주차/')) {
        currentGroup = '10주차';
    } else if (decodedPath.includes('/5주차/')) {
        currentGroup = '5주차';
    }
    
    const navItems = allNavItems.filter(item => item.group === currentGroup);

    // 3. HTML 구조 생성
    const navHtml = `
        <nav class="top-nav">
            <div class="nav-container">
                <a href="../index.html" class="nav-item main-nav-item">
                    <span class="home-icon">🏠</span> 메인화면
                </a>
                <div class="nav-center-group">
                    ${navItems.map(item => {
                        // ../부분 제거 후 현재 경로와 포함 여부 비교
                        const relativeTarget = item.href.replace('../', '/');
                        const isActive = decodedPath.includes(relativeTarget) ? 'active' : '';
                        return `
                        <a href="${item.href}" class="nav-item ${isActive}">
                            ${item.text}
                        </a>
                        `;
                    }).join('')}
                </div>
            </div>
        </nav>
    `;

    // 4. 페이지 최상단에 삽입
    if (!document.querySelector('.top-nav')) {
        document.body.insertAdjacentHTML('afterbegin', navHtml);
    }
    
    // 5. 사이드 내비게이션 생성을 위한 추가 로직
    initSideNav();
}

// DOM이 이미 로드되었는지 확인 후 실행
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

/**
 * 페이지 내 섹션들을 자동으로 감지하여 왼쪽 사이드 내비게이션을 생성합니다.
 */
function initSideNav() {
    const sections = document.querySelectorAll('section[id^="sim-section-"]');
    if (sections.length === 0) return;

    // 사이드바 컨테이너 생성
    const sideNav = document.createElement('div');
    sideNav.className = 'side-nav';

    const sideNavItems = [];

    sections.forEach((section, index) => {
        const h2 = section.querySelector('h2');
        const label = h2 ? h2.textContent.split(':')[0].trim() : `섹션 ${index + 1}`;
        
        const navItem = document.createElement('div');
        navItem.className = 'side-nav-item';
        navItem.setAttribute('data-target', section.id);
        navItem.setAttribute('data-label', label);
        
        navItem.addEventListener('click', () => {
            section.scrollIntoView({ behavior: 'smooth' });
        });
        
        sideNav.appendChild(navItem);
        sideNavItems.push({ element: navItem, targetId: section.id });
    });

    document.body.appendChild(sideNav);

    // 스크롤 스파이 (Scroll Spy) 로직
    const observerOptions = {
        root: null,
        rootMargin: '-20% 0px -70% 0px', // 화면 중앙 부근에 왔을 때 감지
        threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const targetId = entry.target.id;
                
                // 모든 항목에서 active 클래스 제거
                sideNavItems.forEach(item => {
                    item.element.classList.remove('active');
                    if (item.targetId === targetId) {
                        item.element.classList.add('active');
                    }
                });
            }
        });
    }, observerOptions);

    sections.forEach(section => observer.observe(section));
}
