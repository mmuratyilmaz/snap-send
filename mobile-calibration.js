/* Static optical target for the existing Mobile Companion. No camera or network access. */
(function (global) {
 'use strict';
 const PATTERN = 'checkerboard-10x7-v1';
 function mount() {
  const style = document.createElement('style');
  style.textContent = `
   #calibration-offer{padding:10px 14px;border-bottom:1px solid var(--surface-border);flex:none}
   #calibration-offer button{width:100%;padding:10px;border:1px solid var(--surface-border);border-radius:8px;background:var(--surface-1);color:var(--text-primary);font:inherit}
   #calibration-target{position:fixed;inset:0;z-index:20000;display:flex;flex-direction:column;background:#fff;color:#000;overflow:hidden;forced-color-adjust:none}
   #calibration-target[hidden],#calibration-offer[hidden]{display:none!important}
   #calibration-target .target-toolbar{display:flex;flex:none;align-items:center;justify-content:space-between;gap:8px;padding:8px max(8px,env(safe-area-inset-right)) 8px max(8px,env(safe-area-inset-left));background:#fff;color:#000;font:13px system-ui}
   #calibration-target button{background:#fff;color:#000;border:1px solid #777;padding:7px 10px;border-radius:6px;font:inherit}
   #calibration-target svg{display:block;width:100%;height:100%;flex:1;min-height:0;background:#fff;touch-action:none}
   #calibration-target .target-help{flex:none;padding:4px 10px max(6px,env(safe-area-inset-bottom));font:12px system-ui;text-align:center;background:#fff;color:#333}
   .header-actions{flex-wrap:wrap}
  `;
  document.head.appendChild(style);
  const button = document.createElement('button');
  button.id = 'mobile-calibration-button'; button.className = 'header-file-button'; button.type = 'button';
  button.textContent = 'Kamera ölçümü'; button.disabled = true;
  document.querySelector('.header-actions').prepend(button);
  const offer = document.createElement('div'); offer.id = 'calibration-offer'; offer.hidden = true;
  const accept = document.createElement('button'); accept.type = 'button'; accept.textContent = 'Kamera ölçüm desenini aç';
  offer.appendChild(accept); document.querySelector('header').after(offer);
  const target = document.createElement('section'); target.id = 'calibration-target'; target.hidden = true;
  target.setAttribute('role', 'dialog'); target.setAttribute('aria-modal', 'true'); target.setAttribute('aria-label', 'Kamera ölçüm deseni');
  target.innerHTML = '<div class="target-toolbar"><span>Kamera ölçüm deseni</span><button type="button" id="calibration-fullscreen">Tam ekran</button><button type="button" id="calibration-close">Kapat</button></div><div class="target-help">Telefon ekranını yazıcının kamerasına gösterin. Karelerin tamamı ve beyaz kenarlık görünmeli.</div>';
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 12 9');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet'); svg.setAttribute('aria-label', '10 sütun, 7 satır kareli ölçüm deseni');
  svg.dataset.pattern = PATTERN;
  const rect = (x, y, width, height, fill) => {
   const r = document.createElementNS(ns, 'rect');
   for (const [key, value] of Object.entries({ x, y, width, height, fill })) r.setAttribute(key, String(value));
   svg.appendChild(r);
  };
  rect(0, 0, 12, 9, '#fff');
  for (let y = 0; y < 7; y++) for (let x = 0; x < 10; x++) if ((x + y) % 2 === 0) rect(x + 1, y + 1, 1, 1, '#000');
  target.insertBefore(svg, target.querySelector('.target-help')); document.body.appendChild(target);
  let connected = false, wakeLock, previousFocus, offerTimer, openGeneration = 0;
  const closeButton = target.querySelector('#calibration-close');
  async function keepAwake() {
   const generation = openGeneration;
   if (target.hidden || document.hidden || !navigator.wakeLock || wakeLock) return;
   try {
    const lock = await navigator.wakeLock.request('screen');
    if (target.hidden || generation !== openGeneration) { await lock.release(); return; }
    wakeLock = lock; lock.addEventListener('release', () => { if (wakeLock === lock) wakeLock = undefined; });
   } catch { /* Displaying the target does not depend on screen wake-lock support. */ }
  }
  function open() {
   if (!connected || !target.hidden) return;
   previousFocus = document.activeElement; openGeneration++; target.hidden = false; offer.hidden = true;
   clearTimeout(offerTimer); closeButton.focus(); void keepAwake();
  }
  function close() {
   if (target.hidden) return;
   openGeneration++; target.hidden = true;
   void wakeLock?.release().catch(() => {}); wakeLock = undefined;
   if (document.fullscreenElement === target) void document.exitFullscreen().catch(() => {});
   previousFocus?.focus?.();
  }
  button.onclick = open; accept.onclick = open; closeButton.onclick = close;
  const fullscreen = target.querySelector('#calibration-fullscreen');
  fullscreen.hidden = typeof target.requestFullscreen !== 'function';
  fullscreen.onclick = () => { void target.requestFullscreen?.().catch(() => {}); };
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !target.hidden) close(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void keepAwake(); });
  global.addEventListener('pagehide', close);
  return {
   open,
   offer(payload) {
    if (!connected || payload?.pattern !== PATTERN || !Number.isFinite(payload.expiresAt) || payload.expiresAt <= Date.now()) return false;
    clearTimeout(offerTimer); offer.hidden = !target.hidden;
    offerTimer = setTimeout(() => { offer.hidden = true; }, Math.min(payload.expiresAt - Date.now(), 15 * 60 * 1000));
    return true;
   },
   setConnected(value) {
    connected = value === true; button.disabled = !connected;
    if (!connected) { clearTimeout(offerTimer); offer.hidden = true; close(); }
   }
  };
 }
 function showStandalone() {
  const ui = mount();
  // The normal companion is not initialized in this mode: no tokens, polling, chat or files.
  for (const child of document.body.children) if (child.id !== 'calibration-target') child.style.display = 'none';
  const home = document.createElement('main');
  home.style.cssText = 'padding:24px;font:16px system-ui;text-align:center;color:#222;background:#fff;min-height:100vh';
  const title = document.createElement('h1'); title.textContent = 'Kamera ölçümü';
  const text = document.createElement('p'); text.textContent = 'Bu sayfa yalnızca kareli deseni gösterir. Hesabınıza, projenize veya yazıcınıza bağlanmaz.';
  text.style.cssText = 'margin:16px 0;line-height:1.5';
  const reopen = document.createElement('button'); reopen.textContent = 'Deseni göster'; reopen.type = 'button';
  reopen.style.cssText = 'padding:12px 20px;background:#111;color:#fff;border:0;border-radius:8px;font:inherit';
  reopen.onclick = () => ui.open(); home.append(title, text, reopen); document.body.appendChild(home);
  ui.setConnected(true); ui.open();
 }
 global.JumperMobileCalibration = { mount, showStandalone, pattern: PATTERN };
})(window);
