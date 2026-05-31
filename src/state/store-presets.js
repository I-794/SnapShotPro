// v9 — App Store / Play Store screenshot size presets.
//
// Pixel sizes target the current store-listing requirements (App Store Connect
// 2024-25 spec + Google Play). Each preset names the device-mockup type used to
// frame the screenshot when the global frame isn't already a device. Store specs
// shift over time — update `w`/`h` here if Apple/Google revise them.

export const STORE_PRESETS = {
  'ios-6.9':       { w: 1320, h: 2868, label: 'iPhone 6.9″',  group: 'iOS',     device: 'iphone16pro' },
  'ios-6.7':       { w: 1290, h: 2796, label: 'iPhone 6.7″',  group: 'iOS',     device: 'iphone16pro' },
  'ios-6.5':       { w: 1242, h: 2688, label: 'iPhone 6.5″',  group: 'iOS',     device: 'iphone' },
  'ios-5.5':       { w: 1242, h: 2208, label: 'iPhone 5.5″',  group: 'iOS',     device: 'iphone' },
  'ipad-13':       { w: 2064, h: 2752, label: 'iPad 13″',     group: 'iOS',     device: 'ipadpro' },
  'ipad-12.9':     { w: 2048, h: 2732, label: 'iPad 12.9″',   group: 'iOS',     device: 'ipadpro' },
  'android-phone': { w: 1080, h: 1920, label: 'Play phone',   group: 'Android', device: 'pixel' },
  'android-tablet':{ w: 1600, h: 2560, label: 'Play tablet',  group: 'Android', device: 'pixel' },
  'mac':           { w: 2880, h: 1800, label: 'Mac',          group: 'Desktop', device: 'macbookpro' }
};

export const STORE_PRESET_ORDER = [
  'ios-6.9', 'ios-6.7', 'ios-6.5', 'ios-5.5', 'ipad-13', 'ipad-12.9',
  'android-phone', 'android-tablet', 'mac'
];

export function getStorePreset(id) {
  return STORE_PRESETS[id] || STORE_PRESETS['ios-6.7'];
}
