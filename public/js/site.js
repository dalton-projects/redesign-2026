(function () {
  'use strict';

  function initMobileNav() {
    var toggle = document.querySelector('[data-mobile-toggle]');
    var panel = document.querySelector('[data-mobile-panel]');
    if (!toggle || !panel) return;
    var menuIcon = toggle.querySelector('[data-icon-menu]');
    var closeIcon = toggle.querySelector('[data-icon-close]');
    var isOpen = false;

    
    var navEl = toggle.closest('nav');
    var flexRow = navEl ? navEl.firstElementChild : null;
    var overflowActive = false;

    
    var logoFull = navEl ? navEl.querySelector('img[src*="Oasis_of_Change-official"]') : null;
    var logoIcon = null;
    if (logoFull) {
      logoIcon = document.createElement('img');
      logoIcon.src = logoFull.src.replace('Oasis_of_Change-official.svg', 'oasis-of-change-icon.svg');
      logoIcon.alt = logoFull.alt;
      logoIcon.className = logoFull.className;
      logoIcon.style.display = 'none';
      logoIcon.width = 56;
      logoIcon.height = 56;
      logoFull.parentNode.insertBefore(logoIcon, logoFull.nextSibling);
    }

    function setLogoCompact(compact) {
      if (!logoFull || !logoIcon) return;
      logoFull.style.display = compact ? 'none' : '';
      logoIcon.style.display = compact ? '' : 'none';
    }

    
    var navUl = flexRow ? flexRow.querySelector('ul') : null;
    var supportWrap = flexRow ? flexRow.querySelector('.justify-end') : null;

    function setNavCompact(compact) {
      if (!flexRow) return;
      flexRow.style.gap = compact ? '0.25rem' : '';
      if (navUl) {
        navUl.style.gap = compact ? '0' : '';
        for (var i = 0; i < navUl.children.length; i++) {
          var a = navUl.children[i].querySelector('a');
          if (a) {
            a.style.paddingLeft = compact ? '0.375rem' : '';
            a.style.paddingRight = compact ? '0.375rem' : '';
          }
        }
      }
      if (supportWrap) supportWrap.style.gap = compact ? '0.25rem' : '';
    }

    
    var navMotionMs = 240;
    var navEase = 'cubic-bezier(0.2, 0.9, 0.2, 1)';
    var navTransitionCss =
      'height ' + navMotionMs + 'ms ' + navEase + ', opacity ' + navMotionMs + 'ms ' + navEase + ', transform ' + navMotionMs + 'ms ' + navEase +
      ', padding-top ' + navMotionMs + 'ms ' + navEase + ', padding-bottom ' + navMotionMs + 'ms ' + navEase;

    function setToggleIcons(open) {
      if (menuIcon && closeIcon) {
        if (open) {
          menuIcon.style.opacity = '0';
          menuIcon.style.pointerEvents = 'none';
          closeIcon.style.opacity = '1';
          closeIcon.style.pointerEvents = 'auto';
        } else {
          menuIcon.style.opacity = '1';
          menuIcon.style.pointerEvents = 'auto';
          closeIcon.style.opacity = '0';
          closeIcon.style.pointerEvents = 'none';
        }
      }
    }

    function closeNavDropdown(dd) {
      dd.style.gridTemplateRows = '0fr';
      var ch = dd.parentElement.querySelector('[data-nav-dropdown-chevron]');
      if (ch) ch.style.transform = '';
    }

    function collapseAllDropdowns() {
      panel.querySelectorAll('[data-nav-dropdown-content]').forEach(closeNavDropdown);
    }

    function viewportCapPx() {
      var top = panel.getBoundingClientRect().top;
      var margin = 20;
      return Math.max(200, window.innerHeight - top - margin);
    }

    function prefersReducedMotion() {
      try {
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      } catch (e) {
        return false;
      }
    }

    function getNaturalPanelContentPx() {
      var inner = panel.firstElementChild;
      if (!inner || inner.nodeType !== 1) {
        return panel.scrollHeight;
      }
      var cs = window.getComputedStyle(panel);
      var padY =
        (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
      
      
      
      return inner.offsetHeight + padY;
    }

    function getPanelTargetPx() {
      var cap = viewportCapPx();
      var want = getNaturalPanelContentPx();
      return Math.min(want, cap);
    }

    function setPanelHeightPx(px, allowTransition) {
      var next = Math.max(0, px) + 'px';
      if (allowTransition === false) {
        var prevTransition = panel.style.transition;
        panel.style.transition = 'none';
        panel.style.height = next;
        void panel.offsetHeight;
        panel.style.transition = prevTransition;
      } else {
        panel.style.height = next;
      }
    }

    function syncOuterPanelHeight() {
      if (!isOpen) return;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          setPanelHeightPx(getPanelTargetPx(), false);
        });
      });
    }

    function open() {
      isOpen = true;
      panel.style.display = '';
      panel.style.paddingTop = '';
      panel.style.paddingBottom = '';
      panel.style.overflowX = 'hidden';
      panel.style.overflowY = 'auto';
      panel.style.overscrollBehavior = 'contain';
      panel.style.setProperty('-webkit-overflow-scrolling', 'touch');
      panel.style.willChange = 'height, transform, opacity';

      if (prefersReducedMotion()) {
        panel.style.transform = 'none';
        panel.style.opacity = '1';
        setPanelHeightPx(getPanelTargetPx(), false);
      } else {
        
        panel.style.transform = 'translateY(-6px)';
        panel.style.opacity = '0';
        setPanelHeightPx(0, false);
        void panel.offsetHeight;

        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            panel.style.opacity = '1';
            panel.style.transform = 'translateY(0)';
            setPanelHeightPx(getPanelTargetPx(), true);
          });
        });
      }
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Close navigation menu');
      setToggleIcons(true);
    }

    function finalizeMobilePanelHidden() {
      if (isOpen) return;
      panel.style.display = 'none';
      panel.style.willChange = '';
      panel.removeEventListener('transitionend', onNavPanelTransitionEnd);
      collapseAllDropdowns();
    }

    function onNavPanelTransitionEnd(e) {
      if (e.target !== panel) return;
      if (e.propertyName !== 'height') return;
      finalizeMobilePanelHidden();
    }

    function close() {
      isOpen = false;
      
      
      try {
        panel.scrollTop = 0;
      } catch (err) {}

      panel.style.overflowY = 'hidden';
      panel.style.overflowX = 'hidden';
      void panel.offsetHeight;

      panel.style.willChange = 'height, transform, opacity';
      panel.removeEventListener('transitionend', onNavPanelTransitionEnd);
      panel.addEventListener('transitionend', onNavPanelTransitionEnd);

      if (prefersReducedMotion()) {
        panel.style.opacity = '0';
        panel.style.transform = 'none';
        panel.style.paddingTop = '0';
        panel.style.paddingBottom = '0';
        setPanelHeightPx(0, false);
        finalizeMobilePanelHidden();
      } else {
        
        
        var startPx = panel.offsetHeight;
        if (!startPx || startPx < 1) {
          startPx = getPanelTargetPx();
        }
        setPanelHeightPx(startPx, false);
        void panel.offsetHeight;
        panel.style.opacity = '0';
        panel.style.transform = 'translateY(-6px)';
        panel.style.paddingTop = '0';
        panel.style.paddingBottom = '0';
        setPanelHeightPx(0, true);
        setTimeout(function () {
          if (!isOpen) finalizeMobilePanelHidden();
        }, navMotionMs + 40);
      }

      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open navigation menu');
      setToggleIcons(false);
    }

    function desktopNavActive() {
      if (overflowActive) return false;
      try {
        return window.matchMedia && window.matchMedia('(min-width: 1024px)').matches;
      } catch (e) {
        return window.innerWidth >= 1024;
      }
    }

    function measureNavOverflow() {
      var children = flexRow.children;
      var savedShrink = [];
      for (var i = 0; i < children.length; i++) {
        savedShrink.push(children[i].style.flexShrink);
        children[i].style.flexShrink = '0';
      }
      var containerWidth = flexRow.clientWidth;
      var totalWidth = 0;
      var visibleCount = 0;
      for (var i = 0; i < children.length; i++) {
        var w = children[i].offsetWidth;
        if (w > 0) { totalWidth += w; visibleCount++; }
      }
      if (visibleCount > 1) totalWidth += 16 * (visibleCount - 1);
      for (var i = 0; i < children.length; i++) {
        children[i].style.flexShrink = savedShrink[i];
      }
      return totalWidth > containerWidth;
    }

    function checkNavOverflow() {
      if (!navEl || !flexRow) return;
      if (window.innerWidth < 1024) {
        navEl.classList.remove('nav-overflow-active');
        overflowActive = false;
        setLogoCompact(false);
        setNavCompact(false);
        return;
      }
      
      navEl.classList.remove('nav-overflow-active');
      overflowActive = false;
      setLogoCompact(false);
      setNavCompact(false);

      
      if (!measureNavOverflow()) return;

      
      setNavCompact(true);
      if (!measureNavOverflow()) return;

      
      setLogoCompact(true);
      if (!measureNavOverflow()) return;

      
      setLogoCompact(false);
      setNavCompact(false);
      navEl.classList.add('nav-overflow-active');
      overflowActive = true;
    }

    function syncNavByViewport() {
      if (desktopNavActive() && isOpen) {
        close();
      }
    }

    panel.style.display = 'none';
    panel.style.height = '0';
    panel.style.opacity = '0';
    panel.style.overflow = 'hidden';
    panel.style.transform = 'translateY(-6px)';
    panel.style.transition = navTransitionCss;

    if (menuIcon) menuIcon.style.transition = 'opacity ' + navMotionMs + 'ms ' + navEase;
    if (closeIcon) closeIcon.style.transition = 'opacity ' + navMotionMs + 'ms ' + navEase;

    window.addEventListener('resize', function () {
      checkNavOverflow();
      syncNavByViewport();
      if (isOpen) setPanelHeightPx(getPanelTargetPx(), false);
    });

    if (menuIcon && closeIcon) {
      closeIcon.style.opacity = '0';
      closeIcon.style.pointerEvents = 'none';
    }

    
    checkNavOverflow();
    window.addEventListener('load', checkNavOverflow);

    toggle.addEventListener('click', function (e) {
      e.preventDefault();
      isOpen ? close() : open();
    });

    panel.querySelectorAll('[data-nav-dropdown-toggle]').forEach(function (btn) {
      var content = btn.nextElementSibling;
      if (!content || !content.hasAttribute('data-nav-dropdown-content')) return;
      var chevron = btn.querySelector('[data-nav-dropdown-chevron]');

      btn.addEventListener('click', function () {
        var expanded = content.style.gridTemplateRows === '1fr';
        if (expanded) {
          closeNavDropdown(content);
        } else {
          panel.querySelectorAll('[data-nav-dropdown-content]').forEach(function (dd) {
            if (dd !== content) closeNavDropdown(dd);
          });
          content.style.gridTemplateRows = '1fr';
          if (chevron) chevron.style.transform = 'rotate(180deg)';
        }
        syncOuterPanelHeight();
      });
    });

    syncNavByViewport();
  }

  function initAccordion() {
    var buttons = document.querySelectorAll('[data-accordion-btn]');
    if (!buttons.length) return;

    buttons.forEach(function (btn) {
      var targetId = btn.getAttribute('data-accordion-btn');
      var content = document.querySelector('[data-accordion-panel="' + targetId + '"]');
      var arrow = btn.querySelector('[data-accordion-arrow]');
      if (!content) return;

      var isOpen = btn.hasAttribute('data-accordion-default');
      content.style.overflow = 'hidden';
      content.style.transition = 'height 0.35s ease, opacity 0.25s ease';

      if (isOpen) {
        content.style.height = 'auto';
        content.style.opacity = '1';
        if (arrow) arrow.classList.add('rotate-90');
      } else {
        content.style.height = '0';
        content.style.opacity = '0';
        if (arrow) arrow.classList.add('rotate-0');
      }

      btn.addEventListener('click', function () {
        var currentlyOpen = content.style.height !== '0' && content.style.height !== '0px';
        var allowMultiple = !!btn.closest('[data-accordion-allow-multiple]');

        if (!allowMultiple) {
          buttons.forEach(function (sibBtn) {
            var sibId = sibBtn.getAttribute('data-accordion-btn');
            var sibContent = document.querySelector('[data-accordion-panel="' + sibId + '"]');
            var sibArrow = sibBtn.querySelector('[data-accordion-arrow]');
            if (sibContent && sibId !== targetId && sibContent.style.height !== '0' && sibContent.style.height !== '0px') {
              sibContent.style.height = sibContent.scrollHeight + 'px';
              void sibContent.offsetHeight;
              sibContent.style.height = '0';
              sibContent.style.opacity = '0';
              if (sibArrow) { sibArrow.classList.remove('rotate-90'); sibArrow.classList.add('rotate-0'); }
            }
          });
        }

        if (currentlyOpen) {
          content.style.height = content.scrollHeight + 'px';
          void content.offsetHeight;
          content.style.height = '0';
          content.style.opacity = '0';
          if (arrow) { arrow.classList.remove('rotate-90'); arrow.classList.add('rotate-0'); }
        } else {
          content.style.display = '';
          content.style.height = '0';
          void content.offsetHeight;
          content.style.height = content.scrollHeight + 'px';
          content.style.opacity = '1';
          if (arrow) { arrow.classList.remove('rotate-0'); arrow.classList.add('rotate-90'); }
          setTimeout(function () { content.style.height = 'auto'; }, 350);
        }
      });
    });
  }

  function initBlogToggle() {
    var trigger = document.querySelector('[data-show-more-trigger]');
    var items = document.querySelectorAll('[data-show-more-item]');
    if (!trigger || !items.length) return;

    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      items.forEach(function (el) { el.classList.remove('hidden'); });
      trigger.style.display = 'none';
    });
  }

  function initImageSlider() {
    var sliders = document.querySelectorAll('[data-image-compare]');
    sliders.forEach(function (slider) {
      var reveal = slider.querySelector('[data-compare-reveal]');
      var divider = slider.querySelector('[data-compare-divider]');
      var handle = slider.querySelector('[data-compare-handle]');
      var beforeLabel = slider.querySelector('[data-compare-label-before]');
      var afterLabel = slider.querySelector('[data-compare-label-after]');
      if (!reveal || !divider || !handle) return;

      var dragging = false;
      var darkPill = ['bg-gray-900', 'text-white', 'border-gray-900', 'shadow-[0_8px_20px_rgba(0,0,0,0.22)]'];
      var lightPill = ['bg-white', 'text-gray-900', 'border-gray-300', 'shadow-[0_4px_12px_rgba(0,0,0,0.08)]'];

      function setPill(el, isDark) {
        if (!el) return;
        (isDark ? lightPill : darkPill).forEach(function (c) { el.classList.remove(c); });
        (isDark ? darkPill : lightPill).forEach(function (c) { el.classList.add(c); });
      }

      function updatePos(pct) {
        reveal.style.width = pct + '%';
        divider.style.left = 'calc(' + pct + '% - 1px)';
        setPill(beforeLabel, pct >= 50);
        setPill(afterLabel, pct < 50);
      }

      handle.addEventListener('pointerdown', function () { dragging = true; });
      window.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        var rect = slider.getBoundingClientRect();
        var pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
        updatePos(pct);
      });
      window.addEventListener('pointerup', function () { dragging = false; });
      window.addEventListener('pointercancel', function () { dragging = false; });
      updatePos(50);
    });
  }

  function initSmoothScroll() {
    var scrollLinks = document.querySelectorAll('.js-scroll-to-ways');
    scrollLinks.forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var targetId = this.getAttribute('href');
        if (!targetId || !targetId.startsWith('#')) return;
        
        var targetElement = document.querySelector(targetId);
        if (!targetElement) return;

        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      });
    });
  }

  function logCuriousCoderMessage() {
    if (typeof window === 'undefined' || !window.console) return;
    if (window.__oocConsoleMessageShown) return;
    window.__oocConsoleMessageShown = true;

    var logo = '  ___            _          __    ___ _                          \n' +
      ' / _ \\ __ _ ___ (_)___  __ / _|  / __| |_  __ _ _ _  __ _ ___   \n' +
      '| (_) / _` (_-< | (_-< / _|  _| | (__| \' \\/ _` | \' \\/ _` / -_)  \n' +
      ' \\___/\\__,_/__/ |_/__/ \\__|_|    \\___|_||_\\__,_|_||_\\__, \\___|  \n' +
      '                                                    |___/        ';

    console.log('%c' + logo, 'color:#4ade80;font-family:monospace;font-weight:700;line-height:1.3;');
    console.log(
      '%c  Hey, conscious coder. %cYou just inspected a website that\n  tries to leave the internet better than it found it.',
      'color:#4ade80;font-size:13px;font-weight:700;',
      'color:#d1d5db;font-size:13px;font-weight:400;'
    );
    console.log(
      '%c  We build sustainable, accessible tech for nonprofits and\n' +
      '  environmental orgs. Every page is lightweight by design.',
      'color:#9ca3af;font-size:12px;line-height:1.5;'
    );
  }

  function initContactForm() {
    var form = document.getElementById('contact-form');
    if (!form) return;

    // Record when the form became available; used as a min-fill-time check
    // against bots that submit instantly.
    window.__cfLoadedAt = Date.now();

    var typeSelect = document.getElementById('cf-type');
    var successEl = document.getElementById('cf-success');
    var conditionals = form.querySelectorAll('.cf-conditional');

    function showSections(type) {
      conditionals.forEach(function (el) {
        var showFor = el.getAttribute('data-cf-show');
        var showUnless = el.getAttribute('data-cf-show-unless');
        var visible = false;

        if (showFor) {
          visible = type === showFor;
        } else if (showUnless) {
          visible = type !== '' && type !== showUnless;
        }

        if (visible) {
          el.classList.add('is-visible');
        } else {
          el.classList.remove('is-visible');
        }
      });
      updateFileSuggestion(type);
    }

    // Context-aware hint for the "Attach a file" field — suggests what kind
    // of document makes sense for each inquiry type. Rendered inside the
    // #cf-file-suggest span right after the "Attach a file" label.
    var FILE_SUGGESTIONS = {
      'general':       'e.g. any supporting document',
      'volunteer':     'e.g. CV / resume',
      'partnership':   'e.g. partnership proposal or org one-pager',
      'donation':      'e.g. donor profile, foundation guidelines, or gift agreement',
      'media':         'e.g. press credentials, journalist CV, or story brief',
      'speaking':      'e.g. speaker bio, headshot, or sample deck',
      'web-ready':     'e.g. current site brief or brand assets',
      'wra-platform':  'e.g. organization overview or impact report',
      'stw':           'e.g. talk proposal, bio, or session outline',
      'vcasse':        'e.g. related research, bio, or proposal',
      'tree-planting': 'e.g. site map or planting project proposal',
    };
    function updateFileSuggestion(type) {
      var el = document.getElementById('cf-file-suggest');
      if (!el) return;
      var s = FILE_SUGGESTIONS[type];
      el.textContent = s ? '— ' + s + ' ' : '';
    }

    // Pre-select inquiry type from URL parameter (?type=volunteer, etc.)
    // Record the value in a module-level flag so the draft-restore pass can
    // skip overwriting it — a shared ?type=… link should always beat an
    // older locally-saved draft.
    var urlPreselect = '';
    try {
      var params = new URLSearchParams(window.location.search);
      var preselect = params.get('type') || '';
      if (preselect && typeSelect) {
        for (var i = 0; i < typeSelect.options.length; i++) {
          if (typeSelect.options[i].value === preselect) {
            typeSelect.value = preselect;
            urlPreselect = preselect;
            showSections(preselect);
            break;
          }
        }
      }
    } catch (e) {
      // URLSearchParams not supported — ignore
    }

    if (typeSelect) {
      typeSelect.addEventListener('change', function () {
        showSections(this.value);
      });
    }

    // Any <select> with an <option value="other">, or any checkbox group
    // containing <input value="other">, gets an accompanying "Please specify"
    // text input injected right after it. Revealed on selection, hidden (and
    // cleared) otherwise. Keeps the HTML DRY — we don't hand-author an "other"
    // field next to every dropdown.
    initOtherFields();

    function initOtherFields() {
      form.querySelectorAll('select').forEach(function (sel) {
        if (!sel.name) return;
        var hasOther = false;
        for (var i = 0; i < sel.options.length; i++) {
          if (sel.options[i].value === 'other') { hasOther = true; break; }
        }
        if (!hasOther) return;

        var otherDiv = makeOtherField(sel.name);
        var wrap = sel.closest('.cf-field') || sel.parentElement;
        wrap.insertAdjacentElement('afterend', otherDiv);

        sel.addEventListener('change', function () {
          if (sel.value === 'other') revealOther(otherDiv);
          else hideOther(otherDiv);
        });
        // Handle pre-selected value (e.g. from URL param or browser autofill)
        if (sel.value === 'other') revealOther(otherDiv, true);
      });

      var seenGroups = {};
      form.querySelectorAll('input[type="checkbox"][value="other"]').forEach(function (box) {
        var name = box.name;
        if (!name || seenGroups[name]) return;
        if (name === 'privacy_consent' || name === 'newsletter') return;
        seenGroups[name] = true;

        var fieldWrap = box.closest('.cf-field');
        if (!fieldWrap) return;

        var otherDiv = makeOtherField(name);
        fieldWrap.insertAdjacentElement('afterend', otherDiv);

        box.addEventListener('change', function () {
          if (box.checked) revealOther(otherDiv);
          else hideOther(otherDiv);
        });
      });
    }

    function makeOtherField(name) {
      var wrap = document.createElement('div');
      wrap.className = 'cf-other-field';
      wrap.setAttribute('data-cf-other-for', name);
      wrap.hidden = true;

      var label = document.createElement('label');
      label.className = 'cf-label';
      label.setAttribute('for', 'cf-other-' + name);
      label.textContent = 'Please specify';

      var input = document.createElement('input');
      input.type = 'text';
      input.id = 'cf-other-' + name;
      input.name = name + '_other';
      input.className = 'cf-input';
      input.placeholder = 'Tell us more';
      input.autocomplete = 'off';

      wrap.appendChild(label);
      wrap.appendChild(input);
      return wrap;
    }

    function revealOther(el, instant) {
      if (!el.hidden) return;
      el.hidden = false;
      if (instant) { el.classList.add('is-visible'); return; }
      // Force reflow so the transition animates from the initial state.
      void el.offsetHeight;
      el.classList.add('is-visible');
    }
    function hideOther(el) {
      if (el.hidden) return;
      el.classList.remove('is-visible');
      var input = el.querySelector('input');
      if (input) input.value = '';
      setTimeout(function () {
        if (!el.classList.contains('is-visible')) el.hidden = true;
      }, 220);
    }

    // Pressing Enter on a text/email/tel/url/date input moves focus to the
    // next visible form field (skipping hidden conditional sections, hidden
    // "other" fields, and the honeypot). Cmd/Ctrl+Enter from anywhere submits
    // the form. Textareas keep native Enter-for-newline behavior.
    form.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;

      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        if (typeof form.requestSubmit === 'function') form.requestSubmit();
        else {
          var sb = form.querySelector('.cf-submit');
          if (sb) sb.click();
        }
        return;
      }

      var t = e.target;
      if (!t || t.tagName !== 'INPUT') return;
      var hijackTypes = ['text', 'email', 'tel', 'url', 'date'];
      if (hijackTypes.indexOf(t.type) === -1) return;

      e.preventDefault();
      var focusables = Array.prototype.slice.call(form.querySelectorAll('input, select, textarea'));
      var visible = focusables.filter(function (el) {
        if (el.disabled || el.type === 'hidden') return false;
        if (el.closest('.cf-honeypot')) return false;
        var section = el.closest('.cf-conditional');
        if (section && !section.classList.contains('is-visible')) return false;
        var other = el.closest('.cf-other-field');
        if (other && other.hidden) return false;
        return el.offsetParent !== null;
      });
      var idx = visible.indexOf(t);
      if (idx >= 0 && idx < visible.length - 1) {
        var next = visible[idx + 1];
        next.focus();
        if (next.tagName === 'INPUT' && hijackTypes.indexOf(next.type) !== -1 && typeof next.select === 'function') {
          try { next.select(); } catch (err) {}
        }
      }
    });

    function clearFieldError(field) {
      var parent = field.closest('.cf-field');
      if (!parent) parent = field.parentElement;
      field.classList.remove('cf-input-error');
      field.removeAttribute('aria-invalid');
      field.removeAttribute('aria-describedby');
      var err = parent ? parent.querySelector('.cf-error-text') : null;
      if (err) err.remove();
    }

    form.addEventListener('input', function (e) { clearFieldError(e.target); });
    form.addEventListener('change', function (e) { clearFieldError(e.target); });

    function addError(field, message) {
      var parent = field.closest('.cf-field');
      if (!parent) parent = field.parentElement;
      if (parent && parent.querySelector('.cf-error-text')) return;

      // Give the error message an id so we can point aria-describedby at it
      var errId = 'cf-err-' + (field.id || field.name || Math.random().toString(36).slice(2));
      var err = document.createElement('p');
      err.id = errId;
      err.className = 'cf-error-text';
      err.setAttribute('role', 'alert');
      err.textContent = message;
      if (parent) parent.appendChild(err);

      field.setAttribute('aria-invalid', 'true');
      field.setAttribute('aria-describedby', errId);

      // Only add red border to text/select inputs, not checkboxes
      if (field.tagName !== 'INPUT' || field.type !== 'checkbox') {
        field.classList.add('cf-input-error');
      }
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // Defensive sync: make every native <select> match its custom widget's
      // currently-selected option. Prevents visual/value drift if anything
      // ever desyncs them (e.g. the draft-restore race that motivated this).
      form.querySelectorAll('.cs-wrap').forEach(function (wrap) {
        var nativeSel = wrap.nextElementSibling;
        if (!nativeSel || nativeSel.tagName !== 'SELECT') return;
        var chosen = wrap.querySelector('.cs-option[aria-selected="true"]');
        if (chosen && chosen.dataset.value && nativeSel.value !== chosen.dataset.value) {
          nativeSel.value = chosen.dataset.value;
        }
      });

      form.querySelectorAll('.cf-error-text').forEach(function (el) { el.remove(); });
      form.querySelectorAll('.cf-input-error').forEach(function (el) { el.classList.remove('cf-input-error'); });

      var required = form.querySelectorAll('[required]');
      var valid = true;

      required.forEach(function (field) {
        var section = field.closest('.cf-conditional');
        if (section && !section.classList.contains('is-visible')) return;

        if (field.type === 'checkbox' && !field.checked) {
          valid = false;
          addError(field, 'This field is required');
        } else if (!field.value || !field.value.trim()) {
          valid = false;
          addError(field, 'This field is required');
        } else if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value)) {
          valid = false;
          addError(field, 'Please enter a valid email address');
        }
      });

      if (!valid) {
        // Focus the first invalid field so keyboard/screen-reader users land on it
        var firstInvalid = form.querySelector('.cf-input-error, [required][aria-invalid="true"]');
        if (!firstInvalid) {
          firstInvalid = form.querySelector('[required]');
        }
        if (firstInvalid) {
          // If the invalid field is a native <select> replaced by a custom one,
          // focus the paired cs-trigger instead.
          if (firstInvalid.tagName === 'SELECT' && firstInvalid.previousElementSibling && firstInvalid.previousElementSibling.classList.contains('cs-wrap')) {
            var t = firstInvalid.previousElementSibling.querySelector('.cs-trigger');
            if (t) t.focus();
          } else {
            firstInvalid.focus();
          }
        }
        var firstErrorEl = form.querySelector('.cf-error-text');
        if (firstErrorEl && firstErrorEl.parentElement) {
          firstErrorEl.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        announceToScreenReader('Form has errors. Please review the highlighted fields.');
        return;
      }

      // Serialize form into a plain object (grouping multi-value checkboxes
      // into arrays) so the server receives clean JSON.
      var payload = {};
      var fd = new FormData(form);
      fd.forEach(function (val, key) {
        if (Object.prototype.hasOwnProperty.call(payload, key)) {
          if (!Array.isArray(payload[key])) payload[key] = [payload[key]];
          payload[key].push(val);
        } else {
          payload[key] = val;
        }
      });
      // FormData omits unchecked checkboxes; coerce consent explicitly.
      var consentEl = form.querySelector('[name="privacy_consent"]');
      payload.privacy_consent = !!(consentEl && consentEl.checked);
      var newsletterEl = form.querySelector('[name="newsletter"]');
      payload.newsletter = !!(newsletterEl && newsletterEl.checked);
      payload.form_loaded_at = window.__cfLoadedAt || 0;

      var submitBtn = form.querySelector('.cf-submit');
      var originalLabel = submitBtn ? submitBtn.textContent : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.setAttribute('aria-busy', 'true');
        submitBtn.textContent = 'Sending\u2026';
      }
      clearFormError();
      announceToScreenReader('Sending your message…');

      uploadFileIfNeeded().then(function (fileUrl) {
        if (fileUrl) payload.attachment_url = fileUrl;
        return fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }).then(function (r) {
        return r.json().then(function (j) { return { ok: r.ok, body: j }; }, function () { return { ok: r.ok, body: {} }; });
      }).then(function (result) {
        if (!result.ok) {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.removeAttribute('aria-busy'); submitBtn.textContent = originalLabel; }
          var msg = (result.body && result.body.error)
            || 'Something went wrong. Please try again, or email us directly.';
          showFormError(msg);
          return;
        }
        if (typeof window.__cfClearDraft === 'function') window.__cfClearDraft();
        form.style.display = 'none';
        if (successEl) {
          successEl.style.display = '';
          // Move focus to the success message so screen readers announce it
          // and keyboard focus lands in a sensible place.
          if (typeof successEl.focus === 'function') {
            successEl.setAttribute('tabindex', '-1');
            successEl.focus();
          }
        }
      }).catch(function () {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.removeAttribute('aria-busy'); submitBtn.textContent = originalLabel; }
        showFormError('Network error. Please check your connection and try again.');
      });
    });

    function clearFormError() {
      var existing = form.querySelector('[data-cf-form-error]');
      if (existing) existing.remove();
    }

    function showFormError(msg) {
      clearFormError();
      var el = document.createElement('p');
      el.setAttribute('data-cf-form-error', '');
      el.className = 'cf-error-text';
      el.setAttribute('role', 'alert');
      el.style.marginTop = '0.75rem';
      el.textContent = msg;
      var submitBtnEl = form.querySelector('.cf-submit');
      var submitField = submitBtnEl ? submitBtnEl.closest('.cf-field') : null;
      if (submitField) submitField.appendChild(el);
    }

    // Saves form data to localStorage on input/change and on beforeunload.
    // Restored automatically on next visit; banner appears with a discard option.
    (function initDraftSave() {
      var DRAFT_KEY = 'cf_draft';
      var DRAFT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
      var banner = document.getElementById('cf-draft-banner');
      var discardBtn = banner ? banner.querySelector('.cf-draft-discard') : null;

      // Treat the form as "empty" if the user hasn't entered anything meaningful.
      // Default-checked boxes, the topic dropdown alone, and consent toggles
      // don't count — drafts should only persist real typed/selected data.
      function hasUserContent(payload) {
        return Object.keys(payload).some(function (key) {
          if (key === 'privacy_consent' || key === 'newsletter') return false;
          if (key === 'inquiry_type') return false;
          var v = payload[key];
          if (typeof v === 'string') return v.trim() !== '';
          if (Array.isArray(v)) return v.some(function (x) {
            return typeof x === 'string' ? x.trim() !== '' : !!x;
          });
          if (typeof v === 'boolean') return v;
          return v != null;
        });
      }

      function saveDraft() {
        var payload = {};
        var fd = new FormData(form);
        fd.forEach(function (val, key) {
          if (key === 'website_url') return; // honeypot — never persist
          if (Object.prototype.hasOwnProperty.call(payload, key)) {
            if (!Array.isArray(payload[key])) payload[key] = [payload[key]];
            payload[key].push(val);
          } else {
            payload[key] = val;
          }
        });
        // Store checked booleans for checkboxes that FormData omits when unchecked
        var consent = form.querySelector('[name="privacy_consent"]');
        var newsletter = form.querySelector('[name="newsletter"]');
        if (consent)    payload.privacy_consent = consent.checked;
        if (newsletter) payload.newsletter = newsletter.checked;

        if (!hasUserContent(payload)) {
          try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
          return;
        }

        try {
          localStorage.setItem(DRAFT_KEY, JSON.stringify({ ts: Date.now(), data: payload }));
        } catch (e) { /* storage full or private mode */ }
      }

      function loadDraft() {
        try {
          var raw = localStorage.getItem(DRAFT_KEY);
          if (!raw) return;
          var parsed = JSON.parse(raw);
          if (!parsed || !parsed.data) return;
          if (Date.now() - parsed.ts > DRAFT_TTL) { localStorage.removeItem(DRAFT_KEY); return; }
          var d = parsed.data;
          if (!hasUserContent(d)) { localStorage.removeItem(DRAFT_KEY); return; }

          Object.keys(d).forEach(function (key) {
            // If the URL pre-selected an inquiry type, don't let an older
            // saved draft overwrite it. Shared ?type=… links always win.
            if (key === 'inquiry_type' && urlPreselect) return;
            var val = d[key];
            var els = form.querySelectorAll('[name="' + key + '"]');
            if (!els.length) return;
            if (els[0].type === 'checkbox') {
              if (typeof val === 'boolean') {
                els[0].checked = val;
              } else {
                var vals = Array.isArray(val) ? val : [val];
                els.forEach(function (cb) { cb.checked = vals.indexOf(cb.value) !== -1; });
              }
            } else if (els[0].tagName === 'SELECT') {
              els[0].value = val;
              els[0].dispatchEvent(new Event('change', { bubbles: true }));
            } else {
              els[0].value = val;
            }
          });

          if (banner) banner.style.display = '';
        } catch (e) { /* corrupt storage */ }
      }

      function clearDraft() {
        try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
        if (banner) banner.style.display = 'none';
      }

      window.__cfClearDraft = clearDraft;

      loadDraft();

      var saveTimer;
      form.addEventListener('input', function () {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveDraft, 1500);
      });
      form.addEventListener('change', function () {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveDraft, 1500);
      });
      window.addEventListener('beforeunload', saveDraft);

      if (discardBtn) {
        discardBtn.addEventListener('click', function () {
          clearDraft();
          // Cancel any pending auto-save so the empty form doesn't get re-saved.
          clearTimeout(saveTimer);
          // Clear each field explicitly. form.reset() only restores
          // defaultValue/defaultChecked, which doesn't reliably wipe values
          // that were set programmatically by loadDraft().
          Array.prototype.forEach.call(form.elements, function (el) {
            if (!el.name && el.tagName !== 'TEXTAREA') return;
            if (el.type === 'checkbox' || el.type === 'radio') {
              el.checked = false;
            } else if (el.tagName === 'SELECT') {
              // Belt-and-suspenders: clear via every API we can in case one
              // doesn't stick (some browsers retain JS-set selection state).
              for (var i = 0; i < el.options.length; i++) {
                el.options[i].selected = false;
              }
              el.value = '';
              if (el.selectedIndex === -1 && el.options.length > 0) {
                el.options[0].selected = true;
              }
            } else if (el.type !== 'submit' && el.type !== 'button' && el.type !== 'reset') {
              el.value = '';
            }
          });
          // Hide any dynamically-revealed "Other → please specify" fields.
          form.querySelectorAll('.cf-other-field').forEach(function (el) {
            el.classList.remove('is-visible');
            el.hidden = true;
          });
          // Re-sync conditional sections and the message char counter,
          // which only listen for user-driven events.
          var typeEl = document.getElementById('cf-type');
          if (typeEl) typeEl.dispatchEvent(new Event('change', { bubbles: true }));
          var msgEl = document.getElementById('cf-message');
          if (msgEl) msgEl.dispatchEvent(new Event('input', { bubbles: true }));
        });
      }
    }());

    (function initCharCounter() {
      var textarea = document.getElementById('cf-message');
      var counter  = document.getElementById('cf-char-count');
      if (!textarea || !counter) return;
      var MAX = 5000;

      function update() {
        var len = textarea.value.length;
        counter.textContent = len.toLocaleString() + ' / ' + MAX.toLocaleString();
        counter.classList.remove('cf-char-warn', 'cf-char-alert');
        if (len >= MAX)  counter.classList.add('cf-char-alert');
        else if (len >= 4750) counter.classList.add('cf-char-alert');
        else if (len >= 4000) counter.classList.add('cf-char-warn');
      }

      textarea.addEventListener('input', update);
      update();
    }());

    (function initInlineValidation() {
      var emailInput = document.getElementById('cf-email');
      if (!emailInput) return;

      emailInput.addEventListener('blur', function () {
        var v = emailInput.value.trim();
        if (!v) return; // empty — leave required validation to submit
        var parent = emailInput.closest('.cf-field') || emailInput.parentElement;
        var existing = parent ? parent.querySelector('.cf-error-text') : null;
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
          emailInput.classList.remove('cf-input-error');
          emailInput.classList.add('cf-input-valid');
          if (existing) existing.remove();
        } else {
          emailInput.classList.remove('cf-input-valid');
          emailInput.classList.add('cf-input-error');
          if (!existing && parent) {
            var err = document.createElement('p');
            err.className = 'cf-error-text';
            err.setAttribute('role', 'alert');
            err.textContent = 'Please enter a valid email address';
            parent.appendChild(err);
          }
        }
      });

      emailInput.addEventListener('input', function () {
        emailInput.classList.remove('cf-input-valid');
      });
    }());

    var _attachedFile = null;

    function announceToScreenReader(msg) {
      var region = document.getElementById('cf-sr-status');
      if (!region) return;
      // Clear first so repeated messages re-announce
      region.textContent = '';
      setTimeout(function () { region.textContent = msg; }, 60);
    }

    (function initFileUpload() {
      var btn      = document.getElementById('cf-file-btn');
      var input    = document.getElementById('cf-file-input');
      var nameEl   = document.getElementById('cf-file-name');
      var clearBtn = document.getElementById('cf-file-clear');
      if (!btn || !input) return;

      btn.addEventListener('click', function () { input.click(); });

      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        if (!file) { _attachedFile = null; return; }
        _attachedFile = file;
        if (nameEl) {
          nameEl.querySelector('.cf-file-name-text').textContent = file.name + ' (' + (file.size / 1024).toFixed(0) + ' KB)';
          nameEl.classList.add('has-file');
        }
        btn.style.display = 'none';
        announceToScreenReader('File attached: ' + file.name);
        // Move focus to the clear button so keyboard users can undo the action
        if (clearBtn) clearBtn.focus();
      });

      if (clearBtn) {
        clearBtn.addEventListener('click', function () {
          _attachedFile = null;
          input.value = '';
          if (nameEl) nameEl.classList.remove('has-file');
          btn.style.display = '';
          announceToScreenReader('Attachment removed');
          btn.focus();
        });
      }
    }());

    function uploadFileIfNeeded() {
      if (!_attachedFile) return Promise.resolve(null);
      var file = _attachedFile;

      return new Promise(function (resolve) {
        var reader = new FileReader();
        reader.onload = function (e) {
          // Strip the data-URL prefix to get raw base64
          var base64 = e.target.result.split(',')[1];
          fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, contentType: file.type, data: base64 })
          }).then(function (r) {
            return r.json();
          }).then(function (j) {
            resolve((j && j.ok && j.url) ? j.url : null);
          }).catch(function () { resolve(null); });
        };
        reader.onerror = function () { resolve(null); };
        reader.readAsDataURL(file);
      });
    }

    // Replaces every select.cf-input with an accessible combobox on desktop.
    // On mobile (≤639px) the native widget is shown instead (CSS handles swap).
    (function initCustomSelects() {
      if (window.matchMedia && window.matchMedia('(max-width: 639px)').matches) return;

      form.querySelectorAll('select.cf-input').forEach(function (sel) {
        var wrap = document.createElement('div');
        wrap.className = 'cs-wrap';

        var uid = (sel.id || sel.name || Math.random().toString(36).slice(2));

        var trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'cs-trigger';
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        var listboxId = 'cs-lb-' + uid;
        trigger.setAttribute('aria-controls', listboxId);
        // Link trigger to the field's <label for=…> so screen readers announce the label
        var labelEl = sel.id ? document.querySelector('label[for="' + sel.id + '"]') : null;
        if (labelEl) {
          if (!labelEl.id) labelEl.id = 'cs-lbl-' + uid;
          trigger.setAttribute('aria-labelledby', labelEl.id);
        } else if (sel.getAttribute('aria-label')) {
          trigger.setAttribute('aria-label', sel.getAttribute('aria-label'));
        }
        if (sel.required) trigger.setAttribute('aria-required', 'true');

        var labelText = document.createElement('span');
        labelText.className = 'cs-label-text cs-placeholder';
        var chevron = document.createElement('span');
        chevron.className = 'cs-chevron';
        chevron.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
        trigger.appendChild(labelText);
        trigger.appendChild(chevron);

        var listbox = document.createElement('ul');
        listbox.id = listboxId;
        listbox.className = 'cs-listbox';
        listbox.setAttribute('role', 'listbox');
        if (labelEl) listbox.setAttribute('aria-labelledby', labelEl.id);
        else if (sel.getAttribute('aria-label')) listbox.setAttribute('aria-label', sel.getAttribute('aria-label'));
        listbox.tabIndex = -1;

        var optionEls = [];
        var placeholder = '';
        for (var i = 0; i < sel.options.length; i++) {
          var opt = sel.options[i];
          if (opt.value === '') { placeholder = opt.text; continue; }
          (function (opt, optIdx) {
            var li = document.createElement('li');
            li.id = 'cs-opt-' + uid + '-' + optIdx;
            li.className = 'cs-option';
            li.setAttribute('role', 'option');
            li.setAttribute('aria-selected', 'false');
            li.dataset.value = opt.value;
            li.textContent = opt.text;
            listbox.appendChild(li);
            optionEls.push(li);
          }(opt, i));
        }

        if (placeholder) labelText.textContent = placeholder;

        wrap.appendChild(trigger);
        wrap.appendChild(listbox);

        sel.parentNode.insertBefore(wrap, sel);

        var highlighted = -1;
        var isOpen = false;

        function open() {
          isOpen = true;
          listbox.classList.add('is-open');
          trigger.setAttribute('aria-expanded', 'true');
          // If nothing is highlighted yet, start at the selected option (if any) or 0
          if (highlighted < 0) {
            var selIdx = optionEls.findIndex(function (o) { return o.getAttribute('aria-selected') === 'true'; });
            highlight(selIdx >= 0 ? selIdx : 0);
          }
          if (highlighted >= 0) optionEls[highlighted].scrollIntoView({ block: 'nearest' });
        }

        function close() {
          isOpen = false;
          listbox.classList.remove('is-open');
          trigger.setAttribute('aria-expanded', 'false');
          trigger.removeAttribute('aria-activedescendant');
          highlighted = -1;
          optionEls.forEach(function (li) { li.classList.remove('is-highlighted'); });
        }

        function selectOption(idx) {
          if (idx < 0 || idx >= optionEls.length) return;
          var li = optionEls[idx];
          optionEls.forEach(function (o) { o.setAttribute('aria-selected', 'false'); });
          li.setAttribute('aria-selected', 'true');
          labelText.textContent = li.textContent;
          labelText.classList.remove('cs-placeholder');
          // Sync native select so FormData picks it up
          sel.value = li.dataset.value;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          close();
          trigger.focus();
        }

        function highlight(idx) {
          if (idx < 0) idx = optionEls.length - 1;
          if (idx >= optionEls.length) idx = 0;
          optionEls.forEach(function (o) { o.classList.remove('is-highlighted'); });
          if (optionEls[idx]) {
            optionEls[idx].classList.add('is-highlighted');
            optionEls[idx].scrollIntoView({ block: 'nearest' });
            // aria-activedescendant points to the visually-highlighted option
            // so screen readers read it even though focus stays on the trigger.
            trigger.setAttribute('aria-activedescendant', optionEls[idx].id);
          }
          highlighted = idx;
        }

        trigger.addEventListener('click', function () {
          if (isOpen) close(); else open();
        });

        // Typeahead: jump to first option starting with typed characters.
        var typeaheadBuf = '';
        var typeaheadTimer = null;
        function typeahead(ch) {
          clearTimeout(typeaheadTimer);
          typeaheadBuf += ch.toLowerCase();
          typeaheadTimer = setTimeout(function () { typeaheadBuf = ''; }, 600);
          var match = optionEls.findIndex(function (o) {
            return o.textContent.toLowerCase().indexOf(typeaheadBuf) === 0;
          });
          if (match >= 0) {
            if (!isOpen) open();
            highlight(match);
          }
        }

        trigger.addEventListener('keydown', function (e) {
          if (e.key === 'ArrowDown') { e.preventDefault(); if (!isOpen) open(); else highlight(highlighted + 1); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); if (!isOpen) open(); else highlight(highlighted - 1); }
          else if (e.key === 'Home') { e.preventDefault(); if (!isOpen) open(); highlight(0); }
          else if (e.key === 'End') { e.preventDefault(); if (!isOpen) open(); highlight(optionEls.length - 1); }
          else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (isOpen) { if (highlighted >= 0) selectOption(highlighted); } else open(); }
          else if (e.key === 'Escape') { if (isOpen) { e.preventDefault(); close(); } }
          else if (e.key === 'Tab') { close(); /* let tab proceed */ }
          else if (e.key.length === 1 && /\S/.test(e.key)) { typeahead(e.key); }
        });

        optionEls.forEach(function (li, idx) {
          li.addEventListener('mouseenter', function () { highlight(idx); });
          li.addEventListener('click', function () { selectOption(idx); });
        });

        document.addEventListener('click', function (e) {
          if (!wrap.contains(e.target)) close();
        });

        // If the native select already has a value (e.g. from URL param), sync it
        if (sel.value) {
          var preIdx = optionEls.findIndex(function (li) { return li.dataset.value === sel.value; });
          if (preIdx >= 0) {
            optionEls[preIdx].setAttribute('aria-selected', 'true');
            labelText.textContent = optionEls[preIdx].textContent;
            labelText.classList.remove('cs-placeholder');
            highlighted = preIdx;
          }
        }

        // Also listen for native select changes (e.g. from URL pre-select) so
        // the custom widget stays in sync.
        sel.addEventListener('change', function () {
          var idx = optionEls.findIndex(function (li) { return li.dataset.value === sel.value; });
          if (idx >= 0) {
            optionEls.forEach(function (o) { o.setAttribute('aria-selected', 'false'); });
            optionEls[idx].setAttribute('aria-selected', 'true');
            labelText.textContent = optionEls[idx].textContent;
            labelText.classList.remove('cs-placeholder');
          }
        });
      });
    }());
  }

  function initLightbox() {
    var triggers = document.querySelectorAll('[data-lightbox-trigger]');
    if (!triggers.length) return;

    // Build the overlay once and reuse it.
    var overlay = document.createElement('div');
    overlay.className = 'lightbox';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Image viewer');
    overlay.innerHTML =
      '<button type="button" class="lightbox-close" aria-label="Close image viewer">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
      '</button>' +
      '<img class="lightbox-image" alt="" />';
    document.body.appendChild(overlay);

    var overlayImg = overlay.querySelector('.lightbox-image');
    var closeBtn = overlay.querySelector('.lightbox-close');
    var lastTrigger = null;

    function openLightbox(trigger) {
      lastTrigger = trigger;
      overlayImg.src = trigger.getAttribute('data-lightbox-src');
      overlayImg.alt = trigger.getAttribute('data-lightbox-alt') || '';
      overlay.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      closeBtn.focus();
    }

    function closeLightbox() {
      overlay.classList.remove('is-open');
      document.body.style.overflow = '';
      if (lastTrigger) lastTrigger.focus();
    }

    triggers.forEach(function (trigger) {
      trigger.addEventListener('click', function () {
        openLightbox(trigger);
      });
    });

    closeBtn.addEventListener('click', closeLightbox);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeLightbox();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('is-open')) {
        closeLightbox();
      }
    });
  }

  function initCopyrightYear() {
    var year = String(new Date().getFullYear());
    document.querySelectorAll('[data-copyright-year]').forEach(function (el) {
      el.textContent = year;
    });
  }

  function initFooterLocale() {
    var brand = document.querySelector('.site-footer-brand');
    if (!brand || brand.querySelector('.footer-locale')) return;
    // Derive base path from the brand logo img — its src already has the correct
    // depth prefix ('../' on blog pages, '' on root). This keeps the flag working
    // regardless of how deep the page is in the directory tree.
    var logo = brand.querySelector('img');
    var base = '';
    if (logo) {
      var src = logo.getAttribute('src') || '';
      var idx = src.indexOf('images/');
      if (idx !== -1) base = src.slice(0, idx);
    }
    var lang = document.documentElement.lang || 'en';
    var localeText = { en: 'Based in Vancouver, Canada', es: 'Con sede en Vancouver, Canadá', fr: 'Basée à Vancouver, Canada' };
    var locale = document.createElement('div');
    locale.className = 'footer-locale';
    locale.setAttribute('translate', 'no');
    locale.setAttribute('aria-label', localeText[lang] || localeText.en);
    locale.innerHTML =
      '<span><span data-lang-text="en">Based in Vancouver, Canada</span><span data-lang-text="es">Con sede en Vancouver, Canadá</span><span data-lang-text="fr">Basée à Vancouver, Canada</span></span>' +
      '<img class="footer-locale-flag" src="' + base + 'images/flag-canada.svg" alt="" width="22" height="11" loading="lazy" aria-hidden="true">';
    brand.appendChild(locale);
  }

  function initScrollReveal() {
    if (!('IntersectionObserver' in window)) return;
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var targets = document.querySelectorAll('[data-reveal]');
    if (!targets.length) return;
    if (reduced) {
      targets.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    targets.forEach(function (el) { observer.observe(el); });
  }

  function initYouTubeFacades() {
    var facades = document.querySelectorAll('[data-yt-facade]');
    var warmed = false;
    function warmYouTube() {
      if (warmed) return;
      warmed = true;
      ['https://www.youtube-nocookie.com', 'https://i.ytimg.com', 'https://s.ytimg.com'].forEach(function (host) {
        var l = document.createElement('link');
        l.rel = 'preconnect';
        l.href = host;
        document.head.appendChild(l);
      });
    }
    facades.forEach(function (facade) {
      var activated = false;
      function activate() {
        if (activated) return;
        activated = true;
        var id = facade.getAttribute('data-video-id');
        var start = facade.getAttribute('data-start');
        var title = facade.getAttribute('data-title') || 'YouTube video';
        if (!id) return;
        facade.classList.add('is-active', 'is-loading');
        var params = 'autoplay=1&rel=0&modestbranding=1&playsinline=1';
        if (start && start !== '0') params += '&start=' + encodeURIComponent(start);
        var spinner = document.createElement('span');
        spinner.className = 'yt-spinner';
        spinner.setAttribute('aria-hidden', 'true');
        var iframe = document.createElement('iframe');
        iframe.className = 'yt-iframe';
        iframe.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?' + params;
        iframe.title = title;
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
        iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
        iframe.allowFullscreen = true;
        iframe.addEventListener('load', function () {
          facade.classList.remove('is-loading');
          if (spinner.parentNode) spinner.parentNode.removeChild(spinner);
        });
        facade.appendChild(spinner);
        facade.appendChild(iframe);
        facade.removeAttribute('data-yt-facade');
      }
      // Pre-warm connections when the user shows intent (hover / focus / touch)
      var prewarm = function () { warmYouTube(); };
      facade.addEventListener('pointerenter', prewarm, { once: true });
      facade.addEventListener('focusin', prewarm, { once: true });
      facade.addEventListener('touchstart', prewarm, { once: true, passive: true });
      facade.addEventListener('click', activate);
      facade.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initMobileNav();
    initAccordion();
    initBlogToggle();
    initImageSlider();
    initSmoothScroll();
    initContactForm();
    initLightbox();
    initFooterLocale();
    initCopyrightYear();
    initScrollReveal();
    initYouTubeFacades();
    logCuriousCoderMessage();
  });
})();
