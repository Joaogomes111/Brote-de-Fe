/*
 * CopyForge: interações básicas da página clonada. O JavaScript original não vem no clone (ele desfaria o
 * retrato), então este script cobre os padrões mais comuns sem depender de nenhum site:
 * - link e formulário do site original vêm desativados (data-cf-href / data-cf-action): o clique não sai do clone;
 * - clique que cai numa camada morta (controles de carrossel, máscaras) atravessa até o link ou botão de baixo;
 * - botão de fechar (×, "Fechar", "Aceitar") fecha a camada fixa ou o diálogo em que está; Esc fecha diálogos;
 * - menus com aria-expanded, abas com role="tab" e os componentes do Bootstrap (collapse, dropdown, tab, modal);
 * - setas e bolinhas de carrossel rolam a trilha de itens;
 * - dentro da prévia (iframe), link para outro site abre em nova aba em vez de carregar ali dentro.
 */
(() => {
  'use strict';

  const framed = (() => {
    try {
      return window.top !== window.self;
    } catch (ignored) {
      return true;
    }
  })();

  const INTERACTIVE =
    'a[href], button, input, select, textarea, label, summary, [role="button"], [role="tab"], [role="link"], [onclick]';
  const CLOSE_TEXT = /^(×|✕|✖|x|fechar|close|dismiss|agora não|não, obrigado|no thanks)$/i;
  const CLOSE_HINT = /(close|fechar|dismiss)/i;
  const ACCEPT_TEXT = /^(aceitar|aceito|aceitar todos|aceitar cookies|ok|entendi|concordo|accept|accept all|got it)$/i;
  // "left"/"right" só como palavra solta ou entre separadores (NavigationArrow_right__x, arrow-left).
  const PREVIOUS = /(prev|anterior|previous|esquerda|(^|[^a-z])left([^a-z]|$))/i;
  const NEXT = /(next|pr[oó]xim|avan[cç]|direita|(^|[^a-z])right([^a-z]|$))/i;
  const DIALOG = '[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog, .modal';

  const text = (element) => (element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent || '').trim();
  const describe = (element) =>
    [text(element).slice(0, 40), element.getAttribute('class') || '', element.id,
      ...[...element.attributes].filter((attribute) => attribute.name.startsWith('data-')).map((attribute) => `${attribute.name}=${attribute.value}`)]
      .join(' ');

  const isShown = (element) => {
    const style = getComputedStyle(element);
    return !element.hidden && style.display !== 'none' && style.visibility !== 'hidden';
  };
  const hide = (element) => {
    element.hidden = true;
    element.style.setProperty('display', 'none', 'important');
  };
  const show = (element) => {
    element.hidden = false;
    element.style.removeProperty('display');
    if (getComputedStyle(element).display === 'none') element.style.setProperty('display', 'block', 'important');
  };

  /** Aviso discreto, só na prévia: deixa claro que o clique foi entendido, não que a página travou. */
  let toastTimer = 0;
  const notice = (message) => {
    if (!framed || !document.body) return;
    let toast = document.getElementById('copyforge-aviso');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'copyforge-aviso';
      toast.setAttribute('role', 'status');
      toast.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;'
        + 'padding:10px 16px;border-radius:999px;background:rgba(23,36,43,.92);color:#fff;'
        + 'font:600 13px/1.3 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25);pointer-events:none;'
        + 'transition:opacity .2s;opacity:0';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 1800);
  };

  const unlockScroll = () => {
    for (const root of [document.documentElement, document.body]) {
      if (getComputedStyle(root).overflowY === 'hidden') root.style.setProperty('overflow-y', 'auto', 'important');
    }
  };

  /** Camada que contém o elemento: diálogo ou bloco de posição fixa. */
  const layerOf = (element) => {
    for (let node = element; node && node !== document.body; node = node.parentElement) {
      if (node.matches(DIALOG) || getComputedStyle(node).position === 'fixed') return node;
    }
    return null;
  };

  const closeLayer = (layer) => {
    hide(layer);
    document.querySelectorAll('.modal-backdrop, [class*="backdrop" i], [class*="overlay" i]').forEach((element) => {
      if (getComputedStyle(element).position === 'fixed' && !element.contains(layer)) hide(element);
    });
    unlockScroll();
  };

  /** O controle clicado: o botão/link de verdade; só sem ele, o elemento marcado por classe ou rótulo. */
  const controlAt = (target, fallback) => target.closest('button, [role="button"], a') || target.closest(fallback);

  const handleClose = (target, event) => {
    const control = controlAt(target, '[class*="close" i], [class*="fechar" i], [aria-label], [data-bs-dismiss], [data-dismiss]');
    if (!control) return false;
    const label = text(control);
    const icon = control.querySelector('[class*="close" i], [class*="fechar" i]');
    const dismiss = control.matches('[data-bs-dismiss], [data-dismiss]');
    const closes = dismiss || CLOSE_TEXT.test(label) || CLOSE_HINT.test(control.getAttribute('aria-label') || '')
      || CLOSE_HINT.test(control.getAttribute('class') || '') || CLOSE_HINT.test(control.id)
      || (icon !== null && label.length <= 2);
    const layer = layerOf(control);
    if (!layer || !(closes || ACCEPT_TEXT.test(label))) return false;
    event.preventDefault();
    closeLayer(dismiss ? control.closest('.modal, .alert, .offcanvas, .toast') || layer : layer);
    return true;
  };

  const targetsOf = (trigger) => {
    const selector = trigger.getAttribute('data-bs-target') || trigger.getAttribute('data-target')
      || ((trigger.getAttribute('href') || '').startsWith('#') ? trigger.getAttribute('href') : null);
    if (!selector || selector === '#') return [];
    try {
      return [...document.querySelectorAll(selector)];
    } catch (ignored) {
      return [];
    }
  };

  const handleBootstrap = (target, event) => {
    const trigger = target.closest('[data-bs-toggle], [data-toggle]');
    if (!trigger) return false;
    const kind = trigger.getAttribute('data-bs-toggle') || trigger.getAttribute('data-toggle');
    if (kind === 'collapse') {
      const targets = targetsOf(trigger);
      const open = !targets.some((element) => element.classList.contains('show'));
      targets.forEach((element) => element.classList.toggle('show', open));
      trigger.setAttribute('aria-expanded', String(open));
      trigger.classList.toggle('collapsed', !open);
    } else if (kind === 'dropdown') {
      const menu = trigger.parentElement && trigger.parentElement.querySelector('.dropdown-menu');
      if (!menu) return false;
      const open = !menu.classList.contains('show');
      document.querySelectorAll('.dropdown-menu.show').forEach((other) => other.classList.remove('show'));
      menu.classList.toggle('show', open);
      trigger.setAttribute('aria-expanded', String(open));
    } else if (kind === 'tab' || kind === 'pill' || kind === 'list') {
      const nav = trigger.closest('.nav, [role="tablist"], .list-group');
      (nav ? nav.querySelectorAll('[data-bs-toggle], [data-toggle]') : [trigger]).forEach((other) => {
        other.classList.toggle('active', other === trigger);
        other.setAttribute('aria-selected', String(other === trigger));
      });
      targetsOf(trigger).forEach((pane) => {
        if (pane.parentElement) [...pane.parentElement.children].forEach((sibling) => sibling.classList.remove('active', 'show'));
        pane.classList.add('active', 'show');
      });
    } else if (kind === 'modal' || kind === 'offcanvas') {
      targetsOf(trigger).forEach((modal) => {
        modal.classList.add('show');
        show(modal);
      });
    } else {
      return false;
    }
    event.preventDefault();
    return true;
  };

  const controlledBy = (trigger) =>
    (trigger.getAttribute('aria-controls') || '').split(/\s+/).filter(Boolean)
      .map((id) => document.getElementById(id)).filter(Boolean);

  /** Elemento com mais conteúdo escondido para o lado (a trilha de verdade, não o contêiner dela). */
  const scrollableIn = (root) => {
    let best = null;
    let hiddenWidth = 10;
    for (const element of [root, ...root.querySelectorAll('*')]) {
      const overflow = element.scrollWidth - element.clientWidth;
      if (element.clientWidth < 120 || overflow <= hiddenWidth) continue;
      if (!['hidden', 'auto', 'scroll'].includes(getComputedStyle(element).overflowX)) continue;
      best = element;
      hiddenWidth = overflow;
    }
    return best;
  };

  /** Trilha do carrossel de um controle: o alvo do aria-controls ou a mais perto subindo até 6 níveis. */
  const trackNear = (control) => {
    for (const root of controlledBy(control)) {
      const track = scrollableIn(root);
      if (track) return track;
    }
    for (let node = control.parentElement, depth = 0; node && node !== document.body && depth < 6; node = node.parentElement, depth++) {
      const track = scrollableIn(node);
      if (track) return track;
    }
    return null;
  };

  const handleTab = (target, event) => {
    const tab = target.closest('[role="tab"]');
    if (!tab) return false;
    const list = tab.closest('[role="tablist"]');
    const tabs = list ? [...list.querySelectorAll('[role="tab"]')] : [tab];
    const panels = new Set(tabs.flatMap(controlledBy));
    if (panels.size === 0) return false;
    if (panels.size < tabs.length) {
      // Todas apontam para o mesmo carrossel: são as bolinhas de paginação, não abas.
      const track = trackNear(tab);
      if (!track) return false;
      track.scrollTo({ left: tabs.indexOf(tab) * track.clientWidth, behavior: 'smooth' });
      tabs.forEach((other) => other.setAttribute('aria-selected', String(other === tab)));
    } else {
      for (const other of tabs) {
        const selected = other === tab;
        other.setAttribute('aria-selected', String(selected));
        controlledBy(other).forEach((panel) => (selected ? show(panel) : hide(panel)));
      }
    }
    event.preventDefault();
    return true;
  };

  /** Menu ou acordeão: aria-expanded no gatilho; alvo em aria-controls ou, sem ele, o próximo irmão. */
  const handleDisclosure = (target, event) => {
    const trigger = target.closest('[aria-expanded]');
    if (!trigger || trigger.matches('[role="tab"]')) return false;
    let targets = controlledBy(trigger);
    if (targets.length === 0 && trigger.nextElementSibling) targets = [trigger.nextElementSibling];
    if (targets.length === 0) return false;
    const expanded = trigger.getAttribute('aria-expanded') === 'true';
    targets.forEach((element) => (expanded ? hide(element) : show(element)));
    trigger.setAttribute('aria-expanded', String(!expanded));
    event.preventDefault();
    return true;
  };

  /** Direção de uma seta: pelo rótulo primeiro (aria-label="next"), depois por classes e atributos data-. */
  const directionOf = (element) => {
    for (const source of [text(element).slice(0, 40), describe(element)]) {
      if (NEXT.test(source)) return 1;
      if (PREVIOUS.test(source)) return -1;
    }
    return 0;
  };

  /** Seta de carrossel: rola a trilha que tem mais itens escondidos para o lado. */
  const handleCarousel = (target, event) => {
    const arrow = controlAt(target, '[class*="arrow" i], [class*="prev" i], [class*="next" i]');
    if (!arrow || (arrow.matches('a[href]') && arrow.getAttribute('href') !== '#')) return false;
    let direction = directionOf(arrow);
    const icon = direction === 0 && arrow.querySelector('[class*="arrow" i], [class*="prev" i], [class*="next" i]');
    if (icon) direction = directionOf(icon);
    if (direction === 0) return false;
    const track = trackNear(arrow);
    if (!track) return false;
    track.scrollBy({ left: direction * track.clientWidth * 0.85, behavior: 'smooth' });
    // A captura congelou a seta "anterior" desabilitada (estava no início); o navegador nem dispara clique nela.
    if (arrow.parentElement) {
      arrow.parentElement.querySelectorAll('button[disabled]').forEach((other) => { other.disabled = false; });
    }
    event.preventDefault();
    return true;
  };

  /** Link do site original: desativado na reescrita do clone; o clique fica na página. */
  const handleOriginalLink = (target, event) => {
    const anchor = target.closest('a[data-cf-href]');
    if (!anchor) return false;
    event.preventDefault();
    notice('Link do site original desativado no clone. Troque o destino na IDE IA.');
    return true;
  };

  /** Camada morta posicionada por cima de um link/botão: para de interceptar o mouse (os controles dela continuam). */
  const deadLayerOver = (target, x, y) => {
    if (target.closest(INTERACTIVE)) return null;
    const stack = document.elementsFromPoint(x, y);
    const control = stack.slice(stack.indexOf(target) + 1).map((element) => element.closest(INTERACTIVE)).find(Boolean);
    if (!control || control.contains(target)) return null;
    let layer = target;
    while (layer.parentElement && !layer.parentElement.contains(control)) layer = layer.parentElement;
    const position = getComputedStyle(layer).position;
    if (position !== 'absolute' && position !== 'fixed') return null;
    return { layer, control };
  };

  const quiet = (layer) => {
    layer.style.setProperty('pointer-events', 'none', 'important');
    layer.querySelectorAll(INTERACTIVE).forEach((element) => element.style.setProperty('pointer-events', 'auto', 'important'));
  };

  const passThrough = (target, event) => {
    const found = deadLayerOver(target, event.clientX, event.clientY);
    if (!found) return false;
    event.preventDefault();
    event.stopPropagation();
    quiet(found.layer);
    found.control.click();
    return true;
  };

  /** Na prévia, link para outro site abre em nova aba: carregar outro site dentro do iframe quebraria a prévia. */
  const openOutside = (target, event) => {
    if (!framed) return false;
    const anchor = target.closest('a[href]');
    if (!anchor) return false;
    const href = anchor.getAttribute('href') || '';
    if (href.startsWith('#') || /^(javascript|mailto|tel|sms):/i.test(href)) return false;
    let url;
    try {
      url = new URL(anchor.href, location.href);
    } catch (ignored) {
      return false;
    }
    if (!/^https?:$/.test(url.protocol)) return false;
    if (url.origin === location.origin && url.pathname === location.pathname && url.hash) return false;
    event.preventDefault();
    window.open(url.href, '_blank', 'noopener');
    return true;
  };

  const handlers = [handleClose, handleBootstrap, handleTab, handleDisclosure, handleCarousel, handleOriginalLink,
    passThrough, openOutside];

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : event.target && event.target.parentElement;
    if (!target) return;
    for (const handler of handlers) {
      try {
        if (handler(target, event)) return;
      } catch (ignored) {
        // uma interação que falhou não pode travar as outras nem a página
      }
    }
  }, true);

  // Sem isto, o mouse alterna entre a camada morta e o card de baixo e o efeito de hover fica piscando.
  document.addEventListener('pointerover', (event) => {
    try {
      const target = event.target instanceof Element ? event.target : null;
      const found = target && deadLayerOver(target, event.clientX, event.clientY);
      if (found) quiet(found.layer);
    } catch (ignored) {
      // melhor esforço
    }
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    document.querySelectorAll(DIALOG).forEach((dialog) => {
      if (isShown(dialog) && layerOf(dialog)) closeLayer(dialog);
    });
  });

  // Formulário do site original nunca envia; na prévia, nenhum formulário sai dela.
  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.hasAttribute('data-cf-action') || framed) {
      event.preventDefault();
      notice('Formulário desativado no clone.');
    }
  }, true);
})();
