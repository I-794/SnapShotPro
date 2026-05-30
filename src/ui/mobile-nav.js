// v7 — mobile off-canvas sidebar drawer.
// Hamburger (#sidebar-toggle-btn, phone-only via CSS) slides the sidebar in
// over a backdrop. Closes on backdrop tap and on any control/tool selection
// inside the sidebar, so the canvas isn't left obstructed on small screens.

export function bindMobileNav() {
  const sidebar = document.querySelector('.sidebar');
  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  if (!sidebar || !toggleBtn) return;

  // Backdrop is created once and reused.
  const backdrop = document.createElement('div');
  backdrop.className = 'sidebar-backdrop';
  document.body.appendChild(backdrop);

  const open = () => { sidebar.classList.add('open'); backdrop.classList.add('show'); };
  const close = () => { sidebar.classList.remove('open'); backdrop.classList.remove('show'); };
  const toggle = () => (sidebar.classList.contains('open') ? close() : open());

  toggleBtn.addEventListener('click', toggle);
  backdrop.addEventListener('click', close);

  // On phones, selecting a tool/control should reveal the canvas again.
  const isPhone = () => window.matchMedia('(max-width: 767px)').matches;
  sidebar.addEventListener('click', (e) => {
    if (!isPhone() || !sidebar.classList.contains('open')) return;
    const t = e.target.closest('button, .preset-button, .scene-tile, .layout-btn, .palette-swatch, .sticker-tile, .size-preset-btn, .shadow-preset-btn');
    if (t) close();
  });

  // Escape closes the drawer too.
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) close();
  });
}
