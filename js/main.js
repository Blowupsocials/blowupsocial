// Mobile nav toggle
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('navLinks');
if (hamburger) {
  hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));
  navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => navLinks.classList.remove('open')));
}

// Animated stat counters
function animateCounter(el, target, suffix) {
  const duration = 2000;
  const start    = performance.now();
  const isFloat  = String(target).includes('.');

  function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    const val = from + (target - from) * eased;
    el.textContent = (isFloat ? val.toFixed(1) : Math.round(val).toLocaleString()) + (suffix || '');
    if (p < 1) requestAnimationFrame(tick);
  }
  const from = 0;
  requestAnimationFrame(tick);
}

const statEls = document.querySelectorAll('[data-target]');
if (statEls.length) {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const el     = e.target;
        const target = parseFloat(el.dataset.target);
        const suffix = el.dataset.suffix || '';
        animateCounter(el, target, suffix);
        io.unobserve(el);
      }
    });
  }, { threshold: 0.5 });
  statEls.forEach(el => io.observe(el));
}

// Buy Now button feedback
document.querySelectorAll('.btn-buy').forEach(btn => {
  btn.addEventListener('click', () => {
    const orig = btn.textContent;
    btn.textContent = '✓ Added';
    btn.style.background = 'linear-gradient(135deg,#059669,#065f46)';
    btn.style.boxShadow  = '0 0 20px rgba(5,150,105,0.5)';
    setTimeout(() => {
      btn.textContent    = orig;
      btn.style.background = '';
      btn.style.boxShadow  = '';
    }, 1800);
  });
});

// Hero search
const heroInput = document.querySelector('.hero-search input');
const heroBtn   = document.querySelector('.hero-search .btn-neon');
if (heroBtn && heroInput) {
  heroBtn.addEventListener('click', () => {
    const q = heroInput.value.trim();
    if (q) {
      const section = document.getElementById('platforms');
      if (section) section.scrollIntoView({ behavior: 'smooth' });
    }
  });
  heroInput.addEventListener('keydown', e => { if (e.key === 'Enter') heroBtn.click(); });
}

// Category cards scroll to platforms
document.querySelectorAll('.cat-card').forEach(card => {
  card.addEventListener('click', () => {
    const sec = document.getElementById('platforms');
    if (sec) sec.scrollIntoView({ behavior: 'smooth' });
  });
});
