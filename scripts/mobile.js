// Venous • comportamentos mobile: rótulos curtos na navegação, tabelas em cartões, botão flutuante, chat em tela cheia e gestos
(() => {
  const mq = matchMedia('(max-width:768px)'), CURTO = { 'Home / Consulta': 'Início', 'Minha Área': 'Minha área', 'Gestão de Usuários': 'Usuários', 'Circulação': 'Circulação' };
  const $ = s => document.querySelector(s);
  function nav() {
    document.querySelectorAll('.nav-tab').forEach(a => {
      if (a.querySelector('.nt')) return; const n = [...a.childNodes].find(x => x.nodeType === 3 && x.textContent.trim()); if (!n) return;
      const t = n.textContent.trim(), s = document.createElement('span'); s.className = 'nt'; s.textContent = t; s.dataset.curto = CURTO[t] || t; n.replaceWith(s);
    });
  }
  function rotular() {
    document.querySelectorAll('table').forEach(tb => {
      const h = [...tb.querySelectorAll('thead th')].map(x => x.textContent.trim()); if (!h.length) return;
      tb.querySelectorAll('tbody tr').forEach(tr => [...tr.children].forEach((td, i) => { if (td.tagName === 'TD' && h[i] && !td.dataset.label && td.colSpan < 2) td.dataset.label = h[i]; }));
    });
  }
  let fab;
  function estado() {
    const chat = !!($('#chatShell')?.classList.contains('abrir') && $('#pane-chat')?.classList.contains('on') && mq.matches);
    document.body.classList.toggle('chat-aberto', chat);
    document.body.classList.toggle('sem-nav', [...document.querySelectorAll('.nav-tab')].filter(a => a.offsetParent).length <= 1);
    if (fab) fab.classList.toggle('on', mq.matches && !chat && !!$('#pane-feed')?.classList.contains('on'));
    { const t = $('.tabs [aria-selected=true]'), c = t?.parentElement; if (c) c.scrollTo({ left: t.offsetLeft - (c.clientWidth - t.clientWidth) / 2, behavior: 'smooth' }); }
  }
  let raf; const agendar = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { nav(); rotular(); estado(); }); };
  function iniciar() {
    nav(); rotular();
    if ($('#comp')) {
      fab = Object.assign(document.createElement('button'), { id: 'fabPost', type: 'button', innerHTML: '<i class="fa-solid fa-pen"></i>', title: 'Nova publicação' }); fab.setAttribute('aria-label', 'Nova publicação'); document.body.appendChild(fab);
      fab.onclick = () => { window.MinhaArea?.aba('feed'); const c = $('#comp'); c.classList.add('open'); c.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => $('#compTxt').focus(), 250); };
      // deslizar para os lados troca de aba
      let x0, y0;
      document.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
      document.addEventListener('touchend', e => {
        if (!mq.matches || x0 == null || e.target.closest('.tray,.midias,input,textarea,select,.tabs,#pane-chat,.modal-overlay.active')) return;
        const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
        if (Math.abs(dx) < 80 || Math.abs(dy) > 45) return;
        const ab = [...document.querySelectorAll('.tabs [data-tab]:not(.hidden)')].map(b => b.dataset.tab), at = $('.tabs [aria-selected=true]')?.dataset.tab, i = ab.indexOf(at), n = ab[i + (dx < 0 ? 1 : -1)];
        if (n) window.MinhaArea?.aba(n);
      }, { passive: true });
    }
    new MutationObserver(agendar).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-selected'] });
    mq.addEventListener('change', agendar); estado();
  }
  document.addEventListener('DOMContentLoaded', iniciar);
})();
