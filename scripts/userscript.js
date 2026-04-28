const { StaticNetFilteringEngine } = require('@gorhill/ubo-core');

(async function initTwitchAdMitigation() {

  // -----------------------------
  // 1. Create filtering engine
  // -----------------------------
  const snfe = await StaticNetFilteringEngine.create();

  await snfe.useLists([
    {
      raw: `
        ! Basic ad / tracker domains
        ||doubleclick.net^
        ||googlesyndication.com^
        ||googleadservices.com^
        ||amazon-adsystem.com^
        ||ads.twitch.tv^
        ||twitchads.com^
      `
    }
  ]);

  console.log('[tizenbrew] ad filter engine initialized');

  // -----------------------------
  // 2. Network blocking (fetch)
  // -----------------------------
  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    const url = typeof args[0] === 'string'
      ? args[0]
      : args[0]?.url;

    if (url && snfe.matchRequest({ url })) {
      console.log('[adblock] blocked fetch:', url);
      return new Response('', { status: 204 });
    }

    return originalFetch.apply(this, args);
  };

  // -----------------------------
  // 3. Network blocking (XHR)
  // -----------------------------
  const open = XMLHttpRequest.prototype.open;
  const send = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._url = url;
    return open.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    if (this._url && snfe.matchRequest({ url: this._url })) {
      console.log('[adblock] blocked xhr:', this._url);
      return;
    }
    return send.apply(this, args);
  };

  // -----------------------------
  // 4. HLS / playlist filtering (Twitch-specific)
  // -----------------------------
  const originalFetchForHLS = window.fetch;

  window.fetch = async (...args) => {
    const url = typeof args[0] === 'string'
      ? args[0]
      : args[0]?.url;

    if (!url) return originalFetchForHLS(...args);

    if (url.includes('.m3u8')) {
      const res = await originalFetchForHLS(url);
      const text = await res.text();

      const cleaned = text
        .split('\n')
        .filter(line => {
          if (!line) return true;

          if (line.includes('ad') && line.includes('segment')) return false;
          if (line.includes('stitched-ad')) return false;
          if (line.includes('amazon-adsystem')) return false;
          if (line.includes('twitch-ads')) return false;

          return true;
        })
        .join('\n');

      return new Response(cleaned, {
        status: 200,
        headers: res.headers
      });
    }

    return originalFetchForHLS(...args);
  };

  // -----------------------------
  // 5. DOM ad removal (Twitch UI)
  // -----------------------------
  function removeAds(root = document) {
    const selectors = [
      '[data-test-selector*="ad"]',
      '[class*="ad-banner"]',
      '[class*="sponsored"]',
      '[aria-label*="Advertisement"]',
      'div[data-a-target="video-ad-label"]',
      'iframe[src*="ads"]'
    ];

    selectors.forEach(sel => {
      root.querySelectorAll(sel).forEach(el => {
        console.log('[adblock] removed DOM ad:', sel);
        el.remove();
      });
    });
  }

  removeAds();

  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === 1) {
          removeAds(node);
        }
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  // -----------------------------
  // 6. Playback heuristic detection
  // -----------------------------
  function detectAdState() {
    setInterval(() => {
      const video = document.querySelector('video');
      if (!video) return;

      const adLabel = document.querySelector('[data-a-target="video-ad-label"]');

      if (adLabel) {
        console.log('[twitch] ad detected');

        try {
          video.muted = true;
          video.playbackRate = 16;
        } catch (e) {}
      }
    }, 1000);
  }

  detectAdState();

  // -----------------------------
  // 7. FIXED Tizen Back Button Handling
  // -----------------------------
  function setupBackButton() {

    document.addEventListener('keydown', (event) => {
      const key = event.key || event.keyCode;

      if (
        key === 'Escape' ||
        key === 'Backspace' ||
        key === 27
      ) {
        event.preventDefault();
        window.history.back();
      }
    });

    if (typeof tizen !== 'undefined') {
      try {
        document.addEventListener('keydown', (event) => {
          if (event.keyCode === 10009) {
            event.preventDefault();
            window.history.back();
          }
        });

        console.log('[tizenbrew] Tizen back key handler active');
      } catch (e) {
        console.warn('[tizenbrew] Tizen API not available');
      }
    }
  }

  setupBackButton();

  console.log('[tizenbrew] Twitch ad mitigation fully active');

})();