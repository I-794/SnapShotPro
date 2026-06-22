// v15 — "What's new" toast.
//
// When a *returning* user opens the studio after a version bump, slide in a
// small, non-blocking card with the latest release's highlights, then mark the
// version seen so it shows at most once per release. Brand-new users get the
// first-run welcome tour instead (welcome.js) and never see this — the two are
// mutually exclusive.
//
// Per-release upkeep: bump CURRENT_VERSION and replace WHATS_NEW with the new
// release's highlights — same checklist step as the editor version badge and
// the changelog page.

const CURRENT_VERSION = '27.0';
const LASTSEEN_KEY = 'snapshotpro_lastseen_version';
const WELCOME_KEY  = 'snapshotpro_welcome_v1';   // set by welcome.js on dismissal

// Latest release only — the newest version's highlights, not an accumulation.
const WHATS_NEW = {
  heading: "🧢 Physical & print mockups",
  items: [
    { title: 'Beyond screens',
      desc: 'The new Surface Studio wraps your image onto real things — a t-shirt, mug, poster, framed print, business card, or packaging box — with proper warp, folds, and lighting.' },
    { title: 'Place it exactly',
      desc: 'Pick a garment or material colour, then size, nudge, rotate, and shade the artwork until it sits right. Quick presets get you a hero shot in one click.' },
    { title: 'Bakes into export',
      desc: 'Like every mockup, the surface renders straight onto the canvas, so it exports to PNG/JPEG and saves with your project. Find it under the Frame tab.' }
  ]
};

function openWhatsNew() {
  const heading = document.getElementById('whatsnew-heading');
  const list = document.getElementById('whatsnew-list');
  if (heading) heading.textContent = WHATS_NEW.heading;
  if (list) {
    list.innerHTML = WHATS_NEW.items.map(it =>
      `<li><b>${it.title}.</b> ${it.desc}</li>`).join('');
  }
  const toast = document.getElementById('whatsnew-toast');
  if (toast) toast.classList.add('visible');
}

function closeWhatsNew() {
  const toast = document.getElementById('whatsnew-toast');
  if (toast) toast.classList.remove('visible');
}

export function bindWhatsNew() {
  const toast = document.getElementById('whatsnew-toast');
  if (!toast) return;

  document.getElementById('whatsnew-close')?.addEventListener('click', closeWhatsNew);
  document.getElementById('whatsnew-got')?.addEventListener('click', closeWhatsNew);

  // Re-openable later (e.g. from a help menu / command palette).
  window.__openWhatsNew = openWhatsNew;

  // Trigger logic — all localStorage in try/catch, matching welcome.js.
  let lastseen = null, welcomeSeen = false;
  try {
    lastseen = localStorage.getItem(LASTSEEN_KEY);
    welcomeSeen = localStorage.getItem(WELCOME_KEY) === 'dismissed';
  } catch (e) {}

  if (lastseen === CURRENT_VERSION) return;   // already saw this version's card

  // Brand-new user (no prior version seen and the welcome tour hasn't run yet):
  // the first-run tour is their intro, so silently mark seen and stay quiet.
  if (!lastseen && !welcomeSeen) {
    try { localStorage.setItem(LASTSEEN_KEY, CURRENT_VERSION); } catch (e) {}
    return;
  }

  // Returning user on a new/absent version: show the card and mark seen now, so
  // it's reliably once-per-version even if they never click.
  setTimeout(openWhatsNew, 600);   // let the studio paint first
  try { localStorage.setItem(LASTSEEN_KEY, CURRENT_VERSION); } catch (e) {}
}
