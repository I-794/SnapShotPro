// Shared behavior for SnapShot-Pro content pages: nav border on scroll +
// scroll-reveal. No per-frame scroll work (IntersectionObserver only).
(function () {
  const nav = document.getElementById('nav');
  if (nav) {
    const sentinel = document.createElement('div');
    sentinel.style.cssText = 'position:absolute;top:0;height:1px;width:1px;';
    document.body.prepend(sentinel);
    new IntersectionObserver(([e]) => nav.classList.toggle('scrolled', !e.isIntersecting),
      { rootMargin: '-8px 0px 0px 0px' }).observe(sentinel);
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const sibs = Array.from(e.target.parentElement.querySelectorAll(':scope > .reveal'));
      const i = Math.max(0, sibs.indexOf(e.target));
      e.target.style.transitionDelay = (i * 65) + 'ms';
      e.target.classList.add('in');
      io.unobserve(e.target);
    });
  }, { threshold: 0.16, rootMargin: '0px 0px -50px 0px' });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
})();
