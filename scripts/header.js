// R.A.I.L.D.A • monta o cabeçalho compacto: avatar com dropdown (Bootstrap) contendo nome/cargo, ajuda e tema; login/sair fica ao lado.
(() => {
  const $ = s => document.querySelector(s);
  function montar() {
    const panel = $('.user-panel'), nome = $('#lblUserName'), login = $('#btnHeaderLogin'); if (!panel || !nome || !login || panel.dataset.rl) return; panel.dataset.rl = '1';
    const idBox = nome.parentElement, ajuda = panel.querySelector('a[href="suporte.html"]'); panel.querySelector(':scope > i')?.remove();
    const dd = document.createElement('div'); dd.className = 'dropdown rl-user';
    dd.innerHTML = '<button type="button" class="rl-avatar" data-bs-toggle="dropdown" data-bs-auto-close="true" aria-expanded="false" aria-label="Menu do usuário"><i class="fa-solid fa-circle-user"></i><span class="rl-first d-none d-sm-inline"></span><i class="fa-solid fa-chevron-down rl-seta"></i></button><div class="dropdown-menu dropdown-menu-end rl-menu"><div class="rl-id"></div><div class="rl-slot"></div></div>';
    panel.prepend(dd); const menu = dd.querySelector('.rl-menu'), slot = menu.querySelector('.rl-slot'), btn = dd.querySelector('.rl-avatar'); menu.querySelector('.rl-id').appendChild(idBox);
    if (ajuda) { ajuda.classList.add('rl-link'); ajuda.insertAdjacentHTML('beforeend', '<span>Suporte e ajuda</span>'); slot.appendChild(ajuda); }
    const tema = () => { const t = $('#btnTema'); if (t && !slot.contains(t)) { slot.appendChild(t); return true; } return !!t; };    // o botão de tema é criado depois pelo script.js
    if (!tema()) { let n = 0; const iv = setInterval(() => { if (tema() || ++n > 50) clearInterval(iv); }, 100); }
    const first = dd.querySelector('.rl-first'), sync = () => { first.textContent = (nome.textContent || '').replace(/\(.*\)/, '').trim().split(/\s+/)[0] || 'Entrar'; };
    new MutationObserver(sync).observe(nome, { childList: true, characterData: true, subtree: true }); sync();
    login.classList.add('rl-login'); const est = () => { login.dataset.estado = /entrar/i.test(login.textContent) ? 'guest' : 'logado'; login.setAttribute('aria-label', login.dataset.estado === 'guest' ? 'Entrar' : 'Sair'); }; new MutationObserver(est).observe(login, { childList: true, characterData: true, subtree: true }); est();
    if (!(window.bootstrap && window.bootstrap.Dropdown)) {                                   // sem Bootstrap (ex.: CDN fora do ar): abre/fecha manualmente
      btn.removeAttribute('data-bs-toggle'); btn.onclick = e => { e.stopPropagation(); const a = menu.classList.toggle('show'); btn.setAttribute('aria-expanded', a); };
      document.addEventListener('click', e => { if (!dd.contains(e.target)) { menu.classList.remove('show'); btn.setAttribute('aria-expanded', 'false'); } });
    }
  }
  document.addEventListener('DOMContentLoaded', () => { montar(); setTimeout(montar, 400); });
})();
