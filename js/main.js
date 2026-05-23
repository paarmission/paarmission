/* ============================================================
   Pa'ar Mission — Main JavaScript
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── AOS Init ──────────────────────────────────────────────
  AOS.init({
    once: true,
    duration: 700,
    offset: 60,
    easing: 'ease-out-cubic',
  });

  // ── Navbar: scroll effect ─────────────────────────────────
  const navbar = document.getElementById('navbar');
  function handleNavScroll() {
    if (window.scrollY > 40) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }
  window.addEventListener('scroll', handleNavScroll, { passive: true });
  handleNavScroll(); // init

  // ── Navbar: smooth active link highlight ─────────────────
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-menu a');

  function setActiveLink() {
    const scrollY = window.scrollY + 100;
    sections.forEach(section => {
      const top = section.offsetTop;
      const bottom = top + section.offsetHeight;
      const id = section.getAttribute('id');
      if (scrollY >= top && scrollY < bottom) {
        navLinks.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${id}`) {
            link.classList.add('active');
          }
        });
      }
    });
  }
  window.addEventListener('scroll', setActiveLink, { passive: true });

  // ── Hamburger Menu ────────────────────────────────────────
  const hamburger = document.getElementById('hamburger');
  const navMenu = document.getElementById('navMenu');

  hamburger.addEventListener('click', () => {
    const isOpen = navMenu.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', isOpen);
    hamburger.classList.toggle('active', isOpen);
  });

  // Close menu on nav link click
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      navMenu.classList.remove('open');
      hamburger.classList.remove('active');
      hamburger.setAttribute('aria-expanded', 'false');
    });
  });

  // ── Hamburger Icon Animation ──────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    .hamburger.active span:nth-child(1) {
      transform: translateY(7px) rotate(45deg);
    }
    .hamburger.active span:nth-child(2) {
      opacity: 0; transform: scaleX(0);
    }
    .hamburger.active span:nth-child(3) {
      transform: translateY(-7px) rotate(-45deg);
    }
    .nav-menu a.active {
      color: var(--color-primary) !important;
      font-weight: 700;
    }
    .navbar:not(.scrolled) .nav-menu a.active {
      color: var(--color-accent-light) !important;
    }
  `;
  document.head.appendChild(style);

  // ── Project Tabs ──────────────────────────────────────────
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;

      // Update buttons
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update contents
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === target) {
          content.classList.add('active');
          // Re-trigger AOS for newly visible elements
          AOS.refresh();
        }
      });
    });
  });

  // ── Contact Form — ?sent=1 파라미터로 돌아오면 성공 화면 표시 ──
  const contactForm = document.getElementById('contactForm');
  const formSuccess = document.getElementById('formSuccess');

  if (contactForm && formSuccess) {
    const params = new URLSearchParams(window.location.search);
    if (params.get('sent') === '1') {
      contactForm.style.display = 'none';
      formSuccess.style.display = 'block';
      formSuccess.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // ── Scroll-to-Top Button ──────────────────────────────────
  const scrollTopBtn = document.getElementById('scrollTop');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 400) {
      scrollTopBtn.classList.add('visible');
    } else {
      scrollTopBtn.classList.remove('visible');
    }
  }, { passive: true });

  scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ── Smooth Anchor Scrolling (offset for fixed nav) ────────
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (!target) return;
      e.preventDefault();
      const navHeight = parseInt(getComputedStyle(document.documentElement)
        .getPropertyValue('--nav-height')) || 72;
      const top = target.getBoundingClientRect().top + window.scrollY - navHeight - 12;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });

  // ── Intersection Observer: number counter ─────────────────
  // (Simple entrance animation for stat-like elements if added later)

  // ── Video Cards — YouTube 모달 플레이어 (오류 153 해결) ──
  // 영상 탭 전환 (에피소드 ↔ 스핀오프)
  const smVtabs = document.querySelectorAll('.sm-vtab');
  const smVtabContents = document.querySelectorAll('.sm-vtab-content');

  smVtabs.forEach(vtab => {
    vtab.addEventListener('click', () => {
      const target = vtab.dataset.vtab;
      smVtabs.forEach(t => t.classList.remove('active'));
      smVtabContents.forEach(c => c.classList.remove('active'));
      vtab.classList.add('active');
      const targetContent = document.getElementById(`vtab-${target}`);
      if (targetContent) targetContent.classList.add('active');
    });
  });

  // ── Safari 감지 (iframe 임베드 차단 브라우저) ──────────────
  // Safari는 YouTube embed 외부 차단 정책으로 오류 153 발생
  // → Safari 환경에서는 YouTube 링크를 새 탭으로 직접 열기
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  // 모달 열기/닫기
  const ytModal       = document.getElementById('ytModal');
  const ytModalIframe = document.getElementById('ytModalIframe');
  const ytModalTitle  = document.getElementById('ytModalTitle');
  const ytModalClose  = document.getElementById('ytModalClose');
  const ytBackdrop    = ytModal ? ytModal.querySelector('.yt-modal-backdrop') : null;

  function openYtModal(videoId, title) {
    // Safari: iframe 대신 YouTube 페이지 직접 열기
    if (isSafari) {
      window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!ytModal || !ytModalIframe) return;
    ytModalIframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
    if (ytModalTitle) ytModalTitle.textContent = title || '';
    ytModal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeYtModal() {
    if (!ytModal) return;
    ytModal.classList.remove('open');
    if (ytModalIframe) ytModalIframe.src = '';
    document.body.style.overflow = '';
  }

  // 썸네일 카드 클릭
  document.querySelectorAll('.sm-video-card').forEach(card => {
    card.addEventListener('click', () => {
      const vid   = card.dataset.vid;
      const title = card.dataset.title;
      if (vid) openYtModal(vid, title);
    });
  });

  // 닫기 버튼 & 배경 클릭
  if (ytModalClose) ytModalClose.addEventListener('click', closeYtModal);
  if (ytBackdrop)   ytBackdrop.addEventListener('click', closeYtModal);

  // ESC 키
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (ytModal && ytModal.classList.contains('open')) closeYtModal();
      if (document.getElementById('letterModal')?.classList.contains('open')) closeLetterModal();
    }
  });

  // ── Hero parallax (light) ────────────────────────────────
  const heroBg = document.querySelector('.hero-bg');
  if (heroBg) {
    window.addEventListener('scroll', () => {
      const scrolled = window.scrollY;
      if (scrolled < window.innerHeight) {
        heroBg.style.transform = `translateY(${scrolled * 0.3}px)`;
      }
    }, { passive: true });
  }

});

/* ============================================================
   기도편지 라이트박스 (전역 함수)
   ============================================================ */
const letterData = {
  prayer3rd: {
    title: '3rd 기도편지 — 태국 단기선교 (25.8.12~20)',
    images: [
      { src: 'images/letters/prayer-01-cover.jpg',    caption: '표지 — 3rd 기도편지' },
      { src: 'images/letters/prayer-02-church.jpg',   caption: '① 판타밋트리니티 교회, 건축 시작' },
      { src: 'images/letters/prayer-06-schedule.jpg', caption: '⑤ 대략적인 스케줄 (25.8.12~20)' },
      { src: 'images/letters/prayer-07-future.jpg',   caption: '⑥ 앞으로의 계획' },
    ]
  }
};

// NOTE: letterCurrent / letterPages 는 notion.js의 _notionModal 로 대체됨
// 하위 호환성을 위해 남겨둡니다 (openLetterModal은 로컬 이미지용)
let letterCurrent = 0;
let letterPages   = [];

function openLetterModal(key) {
  const data = letterData[key];
  if (!data) return;
  letterPages   = data.images;
  letterCurrent = 0;

  const modal = document.getElementById('letterModal');
  document.getElementById('letterModalTitle').textContent = data.title;
  _renderLetterPage();
  _renderLetterThumbs();
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLetterModal() {
  const modal = document.getElementById('letterModal');
  if (!modal) return;
  modal.classList.remove('open');
  document.body.style.overflow = '';
}

function changeLetterPage(dir) {
  letterCurrent = (letterCurrent + dir + letterPages.length) % letterPages.length;
  _renderLetterPage();
  _renderLetterThumbs();
}

function _renderLetterPage() {
  const wrap = document.getElementById('letterModalImgWrap');
  const info = document.getElementById('letterPageInfo');
  if (!wrap || !letterPages.length) return;
  wrap.innerHTML = `<img id="letterModalImg" src="${letterPages[letterCurrent].src}" alt="${letterPages[letterCurrent].caption}" />`;
  if (info) info.textContent = `${letterCurrent + 1} / ${letterPages.length}`;
  // 이전/다음 버튼 표시
  const prev = document.getElementById('letterPrev');
  const next = document.getElementById('letterNext');
  if (prev) prev.style.visibility = letterPages.length > 1 ? 'visible' : 'hidden';
  if (next) next.style.visibility = letterPages.length > 1 ? 'visible' : 'hidden';

  // ── 핀치 줌 & 더블탭 확대 ──────────────────────────────
  _bindImgZoom(wrap);
}

function _bindImgZoom(wrap) {
  let scale = 1, startDist = 0, startScale = 1;
  let translateX = 0, translateY = 0;
  let lastTap = 0;
  let isDragging = false, dragStartX = 0, dragStartY = 0, dragTX = 0, dragTY = 0;

  function getImg() { return wrap.querySelector('img'); }

  function applyTransform(withTransition) {
    const img = getImg();
    if (!img) return;
    img.style.transition = withTransition ? 'transform .25s ease' : 'none';
    img.style.transformOrigin = 'center center';
    img.style.transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
  }

  function resetTransform() {
    scale = 1; translateX = 0; translateY = 0;
    applyTransform(true);
  }

  // 더블탭 확대/축소
  wrap.addEventListener('touchend', (e) => {
    if (e.touches.length > 0) return; // 아직 손가락 남아있으면 무시
    const now = Date.now();
    const timeDiff = now - lastTap;
    lastTap = now;
    if (timeDiff < 280 && timeDiff > 0) {
      e.preventDefault();
      if (scale > 1) { resetTransform(); }
      else { scale = 2.5; translateX = 0; translateY = 0; applyTransform(true); }
    }
  }, { passive: false });

  // 핀치 줌 시작
  wrap.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      isDragging = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      startDist = Math.hypot(dx, dy);
      startScale = scale;
    } else if (e.touches.length === 1 && scale > 1) {
      isDragging = true;
      dragStartX = e.touches[0].clientX;
      dragStartY = e.touches[0].clientY;
      dragTX = translateX;
      dragTY = translateY;
    }
  }, { passive: false });

  // 핀치 줌 이동
  wrap.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      scale = Math.min(Math.max(startScale * (dist / startDist), 1), 5);
      applyTransform(false);
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      e.preventDefault();
      translateX = dragTX + (e.touches[0].clientX - dragStartX) / scale;
      translateY = dragTY + (e.touches[0].clientY - dragStartY) / scale;
      applyTransform(false);
    }
  }, { passive: false });

  // 핀치 줌 끝 — scale만 저장, 리셋 안 함
  wrap.addEventListener('touchend', (e) => {
    isDragging = false;
    if (scale < 1.05) { scale = 1; translateX = 0; translateY = 0; applyTransform(true); }
  }, { passive: true });
}

function _renderLetterThumbs() {
  const wrap = document.getElementById('letterThumbs');
  if (!wrap) return;
  wrap.innerHTML = letterPages.map((p, i) => `
    <button class="letter-thumb${i === letterCurrent ? ' active' : ''}"
      onclick="letterCurrent=${i};_renderLetterPage();_renderLetterThumbs();"
      aria-label="${p.caption}">
      <img src="${p.src}" alt="${p.caption}" loading="lazy" />
    </button>
  `).join('');
}
