(function () {
  'use strict';

  var STORAGE_KEY = 'ooc-lang';
  var LANGS = [
    { code: 'en', label: 'English',  short: 'EN' },
    { code: 'fr', label: 'Fran\u00e7ais', short: 'FR' },
    { code: 'es', label: 'Espa\u00f1ol',  short: 'ES' }
  ];

  var activeLang = 'en';

  // Set html[data-lang] as early as possible (before DOMContentLoaded) so CSS
  // rules driven by html[data-lang="…"] (the hard-coded translation variants)
  // resolve to the correct text on first paint instead of flashing English.
  //
  // IMPORTANT: we deliberately do NOT set html.lang here. Google Translate
  // reads the document's lang attribute as the source language — if it
  // already equals the target (e.g. lang="fr" with googtrans=/en/fr), GT
  // considers the page already translated and silently skips it. The lang
  // attribute must stay "en" (the true source language); GT updates it to
  // the target itself once it has actually translated the page.
  try {
    var earlyParams = new URLSearchParams(location.search);
    var earlyRaw = (earlyParams.get('l') || earlyParams.get('L') || earlyParams.get('lang') || earlyParams.get('language') || '').toLowerCase().trim();
    var earlyStored = '';
    try { earlyStored = localStorage.getItem(STORAGE_KEY) || ''; } catch (e) {}
    var earlyCode = earlyRaw || earlyStored;
    var earlyValid = false;
    for (var ei = 0; ei < LANGS.length; ei++) {
      if (LANGS[ei].code === earlyCode) { earlyValid = true; break; }
    }
    if (earlyValid && earlyCode && earlyCode !== 'en') {
      document.documentElement.setAttribute('data-lang', earlyCode);
    }
  } catch (e) {}

  var desktopBtnLabel = null;
  var desktopDropdownEl = null;
  var isDropdownOpen = false;
  var mobileBarDropdownEl = null;
  var isMobileBarDropdownOpen = false;

  function loadLang() {
    try { var v = localStorage.getItem(STORAGE_KEY); return v && findLang(v) ? v : 'en'; }
    catch (e) { return 'en'; }
  }
  function saveLang(code) {
    try { localStorage.setItem(STORAGE_KEY, code); } catch (e) {}
  }
  function findLang(code) {
    for (var i = 0; i < LANGS.length; i++) { if (LANGS[i].code === code) return LANGS[i]; }
    return null;
  }

  function getUrlLang() {
    try {
      var params = new URLSearchParams(location.search);
      var raw = params.get('l') || params.get('L') || params.get('lang') || params.get('language');
      if (!raw) return null;
      var code = raw.toLowerCase().trim();
      return findLang(code) ? code : null;
    } catch (e) { return null; }
  }

  function setGTCookie(langCode) {
    var val = langCode === 'en' ? '' : '/en/' + langCode;
    var expires = langCode === 'en'
      ? 'Thu, 01 Jan 1970 00:00:00 UTC'
      : new Date(Date.now() + 365 * 864e5).toUTCString();
    document.cookie = 'googtrans=' + val + '; expires=' + expires + '; path=/';
    try {
      var host = location.hostname;
      if (host && host !== 'localhost') {
        document.cookie = 'googtrans=' + val + '; expires=' + expires + '; path=/; domain=.' + host;
      }
    } catch (e) {}
  }

  function loadGoogleTranslate() {
    var el = document.createElement('div');
    el.id = 'google_translate_element';
    document.body.appendChild(el);

    window.googleTranslateElementInit = function () {
      new google.translate.TranslateElement({
        pageLanguage: 'en',
        includedLanguages: 'fr,es',
        autoDisplay: false,
        layout: google.translate.TranslateElement.InlineLayout.SIMPLE
      }, 'google_translate_element');

      if (activeLang !== 'en') {
        waitForGTCombo(function (combo) {
          combo.value = activeLang;
          combo.dispatchEvent(new Event('change'));
        });
      }
    };

    var s = document.createElement('script');
    s.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    s.onerror = function () {};
    document.head.appendChild(s);
  }

  function waitForGTCombo(cb) {
    var n = 0;
    var t = setInterval(function () {
      var combo = document.querySelector('.goog-te-combo');
      if (combo) { clearInterval(t); cb(combo); }
      if (++n > 80) clearInterval(t);
    }, 120);
  }

  function injectGTHideCSS() {
    var s = document.createElement('style');
    s.id = 'ooc-gt-hide';
    s.textContent =
      '#google_translate_element,' +
      '.skiptranslate,' +
      '.goog-te-banner-frame,' +
      '.goog-te-balloon-frame,' +
      '#goog-gt-tt,' +
      '.goog-tooltip,' +
      '.goog-text-highlight { display: none !important; visibility: hidden !important; height: 0 !important; overflow: hidden !important; }' +
      'body { top: 0 !important; }';
    document.head.appendChild(s);
  }

  function globeSvg(w, h) {
    w = w || 16; h = h || 16;
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">' +
      '<path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />' +
      '</svg>';
  }

  function chevronSvg() {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">' +
      '<path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />' +
      '</svg>';
  }

  function checkSvg() {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" aria-hidden="true">' +
      '<path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />' +
      '</svg>';
  }

  // Uses role="menu" + role="menuitemradio" so that:
  //   1. <button> elements are valid menuitemradio children (no role conflict)
  //   2. Options are direct children of the menu (no intermediate wrapper)
  //   3. aria-checked communicates the selected language to screen readers
  function buildDesktopSwitcher() {
    var wrap = document.createElement('div');
    wrap.setAttribute('data-lang-switcher', '');
    wrap.classList.add('notranslate');
    var btn = document.createElement('button');
    btn.setAttribute('type', 'button');
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('data-lang-btn', '');
    btn.className = 'lang-btn notranslate';
    btn.innerHTML = globeSvg() + '<span data-lang-label>' + (findLang(activeLang) || LANGS[0]).short + '</span>' + chevronSvg();
    wrap.appendChild(btn);
    var dd = document.createElement('div');
    dd.setAttribute('data-lang-dropdown', '');
    dd.setAttribute('role', 'menu');
    dd.setAttribute('aria-label', 'Select language');
    dd.className = 'lang-dropdown notranslate';
    // Options are direct children of role="menu" — no wrapper div in between,
    // which satisfies aria-required-children for the menu role.
    var panel = document.createElement('div');
    panel.className = 'lang-dropdown-panel';
    for (var i = 0; i < LANGS.length; i++) {
      var lang = LANGS[i];
      var opt = document.createElement('button');
      opt.setAttribute('type', 'button');
      opt.setAttribute('role', 'menuitemradio');
      opt.setAttribute('data-lang-option', lang.code);
      opt.setAttribute('aria-checked', lang.code === activeLang ? 'true' : 'false');
      opt.className = 'lang-option notranslate' + (lang.code === activeLang ? ' lang-option--active' : '');
      opt.innerHTML =
        '<span class="lang-option-check">' + (lang.code === activeLang ? checkSvg() : '') + '</span>' +
        '<span class="lang-option-name">' + lang.label + '</span>' +
        '<span class="lang-option-code">' + lang.short + '</span>';
      panel.appendChild(opt);
    }
    dd.appendChild(panel);
    wrap.appendChild(dd);
    desktopBtnLabel = btn.querySelector('[data-lang-label]');
    desktopDropdownEl = dd;
    return wrap;
  }

  // Wrapped together with the hamburger in a btnGroup div so justify-between
  // treats both as one unit (keeping them right-aligned together).
  // The wrap is display:none at min-width:1024px via CSS so
  // measureNavOverflow() in site.js sees offsetWidth:0.
  function buildMobileBarSwitcher() {
    var wrap = document.createElement('div');
    wrap.className = 'lang-mobile-globe-wrap notranslate';
    wrap.setAttribute('data-lang-mobile-wrap', '');

    var btn = document.createElement('button');
    btn.setAttribute('type', 'button');
    btn.setAttribute('aria-label', 'Select language');
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('data-lang-mobile-globe', '');
    btn.className = 'lang-mobile-globe-btn notranslate';
    btn.innerHTML = globeSvg(18, 18);
    wrap.appendChild(btn);

    var dd = document.createElement('div');
    dd.className = 'lang-mobile-globe-dropdown notranslate';
    dd.setAttribute('data-lang-mobile-dropdown', '');

    var panel = document.createElement('div');
    panel.className = 'lang-mobile-globe-dropdown-panel';

    for (var i = 0; i < LANGS.length; i++) {
      var lang = LANGS[i];
      var pill = document.createElement('button');
      pill.setAttribute('type', 'button');
      pill.setAttribute('data-lang-mobile-dd-pill', lang.code);
      pill.setAttribute('aria-pressed', lang.code === activeLang ? 'true' : 'false');
      pill.className = 'lang-mobile-dd-pill notranslate' + (lang.code === activeLang ? ' lang-mobile-dd-pill--active' : '');
      pill.textContent = lang.short;
      panel.appendChild(pill);
    }

    dd.appendChild(panel);
    wrap.appendChild(dd);
    mobileBarDropdownEl = dd;
    return wrap;
  }

  function inject() {
    var navEl = document.querySelector('nav[aria-label="Main"]');
    var flexRow = navEl ? navEl.firstElementChild : null;

    if (flexRow) {
      // Desktop dropdown — placed inside the support container (the hidden
      // lg:flex div with justify-end) before the CTA link. The support
      // container is already hidden on mobile via Tailwind's `hidden lg:flex`,
      // so no extra display:none needed.
      var supportContainer = null;
      var supportLink = null;
      var candidates = flexRow.querySelectorAll('.justify-end');
      for (var i = 0; i < candidates.length; i++) {
        var link = candidates[i].querySelector('a');
        if (link) {
          supportContainer = candidates[i];
          supportLink = link;
          break;
        }
      }
      if (supportContainer && supportLink) {
        supportContainer.style.alignItems = 'center';
        // Explicit spacer — guarantees horizontal space between switcher and
        // CTA even if Google Translate strips inline styles or the gap/margin
        // CSS gets clobbered during its DOM walk.
        var switcher = buildDesktopSwitcher();
        var spacer = document.createElement('span');
        spacer.className = 'notranslate';
        spacer.setAttribute('aria-hidden', 'true');
        spacer.style.cssText = 'display:inline-block;width:0.75rem;flex-shrink:0';
        supportContainer.insertBefore(switcher, supportLink);
        supportContainer.insertBefore(spacer, supportLink);
      }

      // Mobile nav-bar globe button — wrap globe+hamburger in a btnGroup so
      // justify-between treats them as one unit (keeps them grouped on the right).
      var hamburger = flexRow.querySelector('[data-mobile-toggle]');
      if (hamburger) {
        var btnGroup = document.createElement('div');
        btnGroup.setAttribute('data-lang-btn-group', '');
        btnGroup.style.display = 'flex';
        btnGroup.style.alignItems = 'center';
        btnGroup.style.gap = '0.5rem';
        flexRow.insertBefore(btnGroup, hamburger);
        btnGroup.appendChild(buildMobileBarSwitcher());
        btnGroup.appendChild(hamburger);
      }
    }

    initDesktopDropdown();
    initMobileBarGlobe();
    initGlobalClickOutside();

    // Notify site.js resize listeners so overflow check runs with new DOM state.
    window.dispatchEvent(new Event('resize'));
  }

  function closeDropdown() {
    if (!desktopDropdownEl) return;
    isDropdownOpen = false;
    desktopDropdownEl.classList.remove('is-open');
    var btn = document.querySelector('[data-lang-btn]');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function initDesktopDropdown() {
    var btn = document.querySelector('[data-lang-btn]');
    if (!btn) return;

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (isDropdownOpen) {
        closeDropdown();
      } else {
        isDropdownOpen = true;
        desktopDropdownEl.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });

    var opts = document.querySelectorAll('[data-lang-option]');
    for (var i = 0; i < opts.length; i++) {
      opts[i].addEventListener('click', function (e) {
        e.stopPropagation();
        var code = this.getAttribute('data-lang-option');
        closeDropdown();
        switchTo(code);
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isDropdownOpen) closeDropdown();
    });
  }

  function openMobileBarDropdown() {
    if (!mobileBarDropdownEl) return;
    isMobileBarDropdownOpen = true;
    mobileBarDropdownEl.classList.add('is-open');
    var btn = document.querySelector('[data-lang-mobile-globe]');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  }

  function closeMobileBarDropdown() {
    if (!mobileBarDropdownEl) return;
    isMobileBarDropdownOpen = false;
    mobileBarDropdownEl.classList.remove('is-open');
    var btn = document.querySelector('[data-lang-mobile-globe]');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function initMobileBarGlobe() {
    var btn = document.querySelector('[data-lang-mobile-globe]');
    if (!btn) return;

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      isMobileBarDropdownOpen ? closeMobileBarDropdown() : openMobileBarDropdown();
    });

    var pills = document.querySelectorAll('[data-lang-mobile-dd-pill]');
    for (var i = 0; i < pills.length; i++) {
      pills[i].addEventListener('click', function (e) {
        e.stopPropagation();
        var code = this.getAttribute('data-lang-mobile-dd-pill');
        closeMobileBarDropdown();
        switchTo(code);
      });
    }

    // Close dropdown when the hamburger opens so both aren't visible at once.
    var hamburger = document.querySelector('[data-mobile-toggle]');
    if (hamburger) {
      hamburger.addEventListener('click', function () {
        if (isMobileBarDropdownOpen) closeMobileBarDropdown();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isMobileBarDropdownOpen) closeMobileBarDropdown();
    });
  }

  function initGlobalClickOutside() {
    document.addEventListener('click', function (e) {
      if (isDropdownOpen) {
        var switcher = document.querySelector('[data-lang-switcher]');
        if (switcher && !switcher.contains(e.target)) closeDropdown();
      }
      if (isMobileBarDropdownOpen) {
        var wrap = document.querySelector('[data-lang-mobile-wrap]');
        if (wrap && !wrap.contains(e.target)) closeMobileBarDropdown();
      }
    });
  }

  function updateSwitcherUI() {
    var info = findLang(activeLang);
    if (!info) return;

    if (desktopBtnLabel) desktopBtnLabel.textContent = info.short;

    var opts = document.querySelectorAll('[data-lang-option]');
    for (var i = 0; i < opts.length; i++) {
      var code = opts[i].getAttribute('data-lang-option');
      var active = code === activeLang;
      opts[i].classList.toggle('lang-option--active', active);
      opts[i].setAttribute('aria-checked', active ? 'true' : 'false');
      var checkSpan = opts[i].querySelector('.lang-option-check');
      if (checkSpan) checkSpan.innerHTML = active ? checkSvg() : '';
    }

    var barPills = document.querySelectorAll('[data-lang-mobile-dd-pill]');
    for (var i = 0; i < barPills.length; i++) {
      var code = barPills[i].getAttribute('data-lang-mobile-dd-pill');
      var active = code === activeLang;
      barPills[i].classList.toggle('lang-mobile-dd-pill--active', active);
      barPills[i].setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  }

  function switchTo(code) {
    if (code === activeLang) return;
    saveLang(code);
    setGTCookie(code);
    // Flag the upcoming non-English switch so we show a one-time machine-
    // translation disclaimer after the page reloads. Switching back to EN
    // clears any pending flag instead.
    try {
      if (code !== 'en') {
        sessionStorage.setItem('ooc-lang-disclaimer-pending', code);
      } else {
        sessionStorage.removeItem('ooc-lang-disclaimer-pending');
      }
    } catch (e) {}
    location.reload();
  }

  // One-time pop-up shown after the user switches to a non-English language.
  // Copy is provided per language and marked translate="no" so Google
  // Translate doesn't re-translate it.
  var DISCLAIMER_COPY = {
    es: {
      title: 'Sobre la traducción',
      body: 'Usamos Google Translate para que Oasis of Change sea accesible a más personas. La traducción puede no ser perfecta y pasar por alto algunos matices, pero creemos que el alcance vale más que la perfección. Si algo se ve raro, puedes volver al inglés en cualquier momento.',
      dismiss: 'Entendido',
      close: 'Cerrar'
    },
    fr: {
      title: 'À propos de la traduction',
      body: 'Nous utilisons Google Translate pour rendre Oasis of Change accessible au plus grand nombre. La traduction n’est pas toujours parfaite et peut manquer certaines nuances, mais nous pensons que la portée vaut plus que la perfection. Si quelque chose semble incorrect, vous pouvez revenir à l’anglais à tout moment.',
      dismiss: 'Compris',
      close: 'Fermer'
    }
  };

  function showLangDisclaimer(code) {
    var copy = DISCLAIMER_COPY[code];
    if (!copy) return;
    if (document.querySelector('[data-ooc-lang-disclaimer]')) return;

    var overlay = document.createElement('div');
    overlay.setAttribute('data-ooc-lang-disclaimer', '');
    overlay.setAttribute('translate', 'no');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'ooc-lang-disclaimer-title');
    overlay.className = 'ooc-lang-disclaimer notranslate';

    var card = document.createElement('div');
    card.className = 'ooc-lang-disclaimer-card';

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'ooc-lang-disclaimer-close';
    closeBtn.setAttribute('aria-label', copy.close);
    closeBtn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>' +
      '</svg>';

    var title = document.createElement('h2');
    title.id = 'ooc-lang-disclaimer-title';
    title.className = 'ooc-lang-disclaimer-title';
    title.textContent = copy.title;

    var body = document.createElement('p');
    body.className = 'ooc-lang-disclaimer-body';
    body.textContent = copy.body;

    var actions = document.createElement('div');
    actions.className = 'ooc-lang-disclaimer-actions';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ooc-lang-disclaimer-btn';
    btn.textContent = copy.dismiss;
    actions.appendChild(btn);

    // Lock the page behind the modal so the user can't scroll the underlying
    // content while the disclaimer is open.
    var prevBodyOverflow = document.body.style.overflow;
    var prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    function dismiss() {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    }
    function onKey(e) {
      if (e.key === 'Escape') dismiss();
    }
    btn.addEventListener('click', dismiss);
    closeBtn.addEventListener('click', dismiss);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) dismiss();
    });
    document.addEventListener('keydown', onKey);

    card.appendChild(closeBtn);
    card.appendChild(title);
    card.appendChild(body);
    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Focus the dismiss button so keyboard users can confirm/Escape immediately.
    setTimeout(function () { btn.focus(); }, 50);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var urlLang = getUrlLang();
    activeLang = urlLang || loadLang();
    if (urlLang) {
      saveLang(urlLang);
      setGTCookie(urlLang);
    }

    injectGTHideCSS();
    inject();
    updateSwitcherUI();

    // Always sync the googtrans cookie with the stored language — even for 'en'.
    // This clears any stale cookie from a prior non-English session so Google
    // Translate does not re-translate a page the user has since reset to English.
    setGTCookie(activeLang);

    // Drive the hard-coded translation spans via data-lang, never via
    // html.lang — see the comment at the top of this file. Setting lang to
    // the target language here is what made Google Translate treat every
    // page as already translated and skip it.
    if (activeLang !== 'en') {
      document.documentElement.setAttribute('data-lang', activeLang);
    } else {
      document.documentElement.removeAttribute('data-lang');
    }

    // Only fetch the Google Translate runtime when the user has actively
    // chosen a non-English language. English visitors (the default) never
    // pay the ~123 kB Translate download.
    if (activeLang !== 'en') {
      loadGoogleTranslate();
    }

    // Show the translation disclaimer once after the user has just switched
    // to a non-English language. Defer briefly so it appears over content
    // that has already been translated.
    try {
      var pendingLang = sessionStorage.getItem('ooc-lang-disclaimer-pending');
      if (pendingLang && pendingLang !== 'en' && pendingLang === activeLang) {
        sessionStorage.removeItem('ooc-lang-disclaimer-pending');
        setTimeout(function () { showLangDisclaimer(pendingLang); }, 600);
      }
    } catch (e) {}
  });
})();
