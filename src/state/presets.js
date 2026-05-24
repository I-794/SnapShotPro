export const gradientPresets = {
  sunset:   { colors: ['#667eea', '#764ba2'], positions: [0, 100], angle: 135 },
  ocean:    { colors: ['#2E3192', '#1BFFFF'], positions: [0, 100], angle: 135 },
  forest:   { colors: ['#134E5E', '#71B280'], positions: [0, 100], angle: 135 },
  fire:     { colors: ['#F2994A', '#F2C94C'], positions: [0, 100], angle: 135 },
  midnight: { colors: ['#0F2027', '#2C5364'], positions: [0, 100], angle: 135 },
  rose:     { colors: ['#ED4264', '#FFEDBC'], positions: [0, 100], angle: 135 },
  purple:   { colors: ['#A8EDEA', '#FED6E3'], positions: [0, 100], angle: 135 },
  mint:     { colors: ['#84fab0', '#8fd3f4'], positions: [0, 100], angle: 135 }
};

export const shadowPresets = {
  soft:   { blur: 40, spread: 10, opacity: 30, x: 0, y: 10 },
  medium: { blur: 60, spread: 20, opacity: 40, x: 0, y: 20 },
  hard:   { blur: 80, spread: 30, opacity: 50, x: 0, y: 30 },
  none:   { blur: 0,  spread: 0,  opacity: 0,  x: 0, y: 0 }
};

export const sizePresets = {
  twitter:   { width: 1200, height: 675 },
  instagram: { width: 1080, height: 1080 },
  facebook:  { width: 1200, height: 630 },
  linkedin:  { width: 1200, height: 627 }
};

export const meshPresets = {
  aurora: ['#667eea', '#f093fb', '#4facfe', '#43e97b'],
  sunset: ['#fa709a', '#fee140', '#ff6a00', '#ee0979'],
  cyber:  ['#00f2fe', '#4facfe', '#a855f7', '#ec4899'],
  pastel: ['#ffecd2', '#fcb69f', '#a1c4fd', '#c2e9fb']
};

export const tiltPresets = {
  iso:  { rx: -20, ry: 25, rz:  0, perspective: 1200 },
  lean: { rx:   0, ry: 18, rz:  0, perspective: 1400 },
  card: { rx:  -8, ry:  0, rz: -4, perspective: 1600 }
};

export const stickers = {
  reactions: ['🔥','👍','💡','⭐','❤️','🎉','😍','🚀','💯','✨','👀','🤯','💎','⚡','🏆','🎯','💪','🙌','👏','🤝'],
  badges:    ['NEW','HOT','FREE','PRO','BETA','SALE','TOP','LIVE','TIP','★','✓','!'],
  arrows:    ['→','←','↑','↓','↗','↘','↙','↖','⇒','⇐','⇑','⇓','➜','➤','➡','⮕'],
  callouts:  ['💬','🗨','📢','📣','🔔','📌','📍','⚠','❗','❓','ℹ','🎈']
};

export const FRAME_INSETS = {
  iphone:  { top: 60, bottom: 40, left: 24, right: 24 },
  chrome:  { top: 90, bottom: 0,  left: 0,  right: 0 },
  safari:  { top: 80, bottom: 0,  left: 0,  right: 0 },
  firefox: { top: 90, bottom: 0,  left: 0,  right: 0 },
  macos:   { top: 40, bottom: 0,  left: 0,  right: 0 },
  windows: { top: 40, bottom: 0,  left: 0,  right: 0 }
};
