// Venous • Catalogação (hub): empréstimos, reservas e desbaste (nuvem)
(() => {
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)], esc = v => escaparHTML(v);
const tit = l => l.titulo_principal || l.tituloPrincipal || 'Sem título', aut = l => l.nome_pessoal || l.autor_entidade || '', ativos = () => (acervoCompleto || []).filter(l => !l.em_lixeira);
const fmt = d => d ? new Date(d).toLocaleDateString('pt-BR') : '-', pad = n => String(n).padStart(2, '0'), isoLocal = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fimDia = s => new Date(String(s).slice(0, 10) + 'T23:59:59'), atrasado = e => !!e.data_devolucao_prevista && fimDia(e.data_devolucao_prevista) < new Date(), diasPara = e => Math.ceil((fimDia(e.data_devolucao_prevista) - new Date()) / 864e5);
const capaHtml = l => l.capa_url ? `<img class="cv" src="${esc(l.capa_url)}" alt="" onerror="this.style.visibility='hidden'">` : '<div class="cv"><i class="fa-solid fa-book"></i></div>';
const equipeAdmin = () => (usuarioAtual.cargo || '').toLowerCase() === 'bibliotecario';

window.hubToast = (m, t) => { let c = $('#toasts'); if (!c) { c = document.createElement('div'); c.id = 'toasts'; document.body.appendChild(c); } const d = document.createElement('div'); d.className = 'toast ' + (t || (/erro|falh/i.test(m) ? 'erro' : '')); d.textContent = m; c.appendChild(d); setTimeout(() => d.remove(), 3500); };
const toast = window.hubToast; window.alert = m => toast(String(m));
window.confirmarAcao = (t, x, r = 'Confirmar') => new Promise(ok => {
  let m = $('#modalConfirmar');
  if (!m) { m = document.createElement('div'); m.id = 'modalConfirmar'; m.className = 'modal-overlay'; m.style.zIndex = 1100; m.innerHTML = '<div class="modal-box"><h3 id="cfT"></h3><p id="cfP" class="muted" style="margin:10px 0 16px"></p><div class="btn-group" style="justify-content:flex-end"><button class="btn btn-outline" id="cfNo">Cancelar</button><button class="btn btn-danger" id="cfYes"></button></div></div>'; document.body.appendChild(m); }
  $('#cfT').textContent = t; $('#cfP').textContent = x; $('#cfYes').textContent = r; m.classList.add('active');
  const fim = v => { m.classList.remove('active'); ok(v); }; $('#cfYes').onclick = () => fim(true); $('#cfNo').onclick = () => fim(false);
});

// ---------- Abas da Catalogação ----------
const SUB = { planilha: 'subTabContentPlanilha', emprestimos: 'subTabContentEmprestimos', reservas: 'subTabContentReservas', etiquetas: 'subTabContentEtiquetas', desbaste: 'subTabContentDesbaste' };
window.trocarSubAbaCatalogacao = (aba, ev) => {
  ev?.preventDefault?.(); if (!SUB[aba]) aba = 'planilha';
  Object.entries(SUB).forEach(([k, id]) => { const e = document.getElementById(id); if (e) e.style.display = k === aba ? 'block' : 'none'; });
  $$('#hubCat [data-sub]').forEach(b => b.setAttribute('aria-selected', b.dataset.sub === aba));
  history.replaceState(null, '', '#' + aba);
  Promise.resolve(window.appReady).then(async () => {
    if (aba === 'emprestimos') { populaSelectsEmprestimo(); await carregarEmprestimos(); empResumo(); }
    if (aba === 'reservas') { await carregarReservas(); renderizarGestaoReservas(); }
    if (aba === 'desbaste') { await carregarDesbastes(); renderDes(); desBuscar(); }
  });
};

// ---------- Empréstimos (formulário guiado + lista com situação) ----------
let livroEmp = null, usrEmp = null, empFiltro = 'todos';
function prazo(n) { const d = new Date(); d.setDate(d.getDate() + n); $('#dataDevolucaoPrevista').value = isoLocal(d); $$('#empPrazos .chip').forEach(c => c.classList.toggle('on', +c.dataset.d === n)); empResumo(); }
function sugerir(inp, box, lista, html, pick) {
  const q = inp.value.trim().toLowerCase(); if (!q) { box.innerHTML = ''; return; }
  const r = lista.filter(x => html.busca(x).toLowerCase().includes(q)).slice(0, 6);
  box.innerHTML = r.map(x => `<button type="button" class="pick" data-i="${x.id}">${html.item(x)}</button>`).join('') || '<small class="muted">Nada encontrado.</small>';
  box.querySelectorAll('.pick').forEach(b => b.onclick = () => { pick(lista.find(x => +x.id === +b.dataset.i)); inp.value = ''; box.innerHTML = ''; empResumo(); });
}
function empResumo() {
  const l = livroEmp, u = usrEmp, out = []; let ok = !!(l && u && $('#dataDevolucaoPrevista').value);
  $('#selectLivroEmprestimo').value = l ? l.id : ''; $('#selectUsuarioEmprestimo').value = u ? u.id : '';
  $('#empLivroSel').innerHTML = l ? `<div class="sel-chip"><span><b>${esc(tit(l))}</b><br><small>${esc(aut(l))}</small></span><button type="button" data-x="l" aria-label="Trocar livro"><i class="fa-solid fa-xmark"></i></button></div>` : '';
  $('#empUsrSel').innerHTML = u ? `<div class="sel-chip"><span><b>${esc(u.nome)}</b><br><small>${esc(u.email || '')}</small></span><button type="button" data-x="u" aria-label="Trocar leitor"><i class="fa-solid fa-xmark"></i></button></div>` : '';
  if (l) { const tot = Number(l.exemplares) || 1, disp = tot - listaEmprestimos.filter(e => +e.livro_id === +l.id).length, rs = listaReservas.filter(r => +r.livro_id === +l.id && r.status === 'Pendente' && +r.usuario_id !== +(u?.id)).length; out.push(`<span class="st ${disp > 0 ? 'Concluida' : 'Cancelada'}">${disp}/${tot} exemplares disponíveis</span>`); if (disp <= 0) ok = false; if (rs) out.push(`<span class="st Pendente">${rs} reserva(s) de outros leitores</span>`); }
  if (u) { const m = listaEmprestimos.filter(e => +e.usuario_id === +u.id), at = m.filter(atrasado).length; out.push(`<span class="st ${at ? 'Cancelada' : 'Concluida'}">${m.length} empréstimo(s) ativo(s)${at ? ` • ${at} em atraso` : ''}</span>`); }
  $('#empResumo').innerHTML = out.join(' '); $('#empResumo').classList.toggle('hidden', !out.length); $('#btnEmp').disabled = !ok;
}
const regOrig = window.registrarEmprestimo;
window.registrarEmprestimo = async e => { e?.preventDefault?.(); await regOrig(null); if (!$('#selectLivroEmprestimo').value) { livroEmp = usrEmp = null; prazo(14); } };
window.renderizarEmprestimos = () => {
  const tb = $('#tabelaEmprestimosBody'); if (!tb) return; const q = ($('#empFiltroQ')?.value || '').toLowerCase();
  const L = (listaEmprestimos || []).map(e => ({ e, l: (acervoCompleto || []).find(x => +x.id === +e.livro_id), u: (listaUsuarios || []).find(x => +x.id === +e.usuario_id) }));
  const at = L.filter(x => atrasado(x.e)).length, br = L.filter(x => !atrasado(x.e) && x.e.data_devolucao_prevista && diasPara(x.e) <= 3).length;
  $('#kAtivos').textContent = L.length; $('#kAtraso').textContent = at; $('#kBreve').textContent = br;
  const v = L.filter(x => (empFiltro === 'todos' || (empFiltro === 'atraso' ? atrasado(x.e) : empFiltro === 'breve' ? !atrasado(x.e) && x.e.data_devolucao_prevista && diasPara(x.e) <= 3 : !atrasado(x.e))) && (!q || `${x.l ? tit(x.l) : ''} ${x.u?.nome || ''}`.toLowerCase().includes(q)));
  tb.innerHTML = v.length ? v.map(({ e, l, u }) => { const a = atrasado(e), d = e.data_devolucao_prevista ? diasPara(e) : null, s = a ? `<span class="st Cancelada">Atrasado ${Math.abs(d)} d</span>` : d !== null && d <= 3 ? `<span class="st Pendente">Vence em ${d} d</span>` : '<span class="st Concluida">No prazo</span>';
    return `<tr><td data-label="Livro"><b>${esc(l ? tit(l) : 'Obra desconhecida')}</b></td><td data-label="Leitor">${esc(u?.nome || 'Usuário')}</td><td data-label="Devolução">${fmt(e.data_devolucao_prevista ? e.data_devolucao_prevista.slice(0, 10) + 'T12:00:00' : '')}</td><td data-label="Situação">${s}</td><td><button class="btn btn-outline btn-sm" data-a="ren" data-id="${e.id}"><i class="fa-solid fa-calendar-plus"></i> +7 dias</button> <button class="btn btn-primary btn-sm" data-a="dev" data-id="${e.id}"><i class="fa-solid fa-rotate-left"></i> Devolver</button></td></tr>`; }).join('') : '<tr><td colspan="5" class="muted" style="text-align:center">Nenhum empréstimo encontrado.</td></tr>';
};
async function renovar(id) {
  const e = listaEmprestimos.find(x => +x.id === +id), b = atrasado(e) ? new Date() : new Date(e.data_devolucao_prevista.slice(0, 10) + 'T12:00:00'); b.setDate(b.getDate() + 7); const nd = isoLocal(b);
  if (supabaseClient) { const { error } = await supabaseClient.from('emprestimos').update({ data_devolucao_prevista: nd }).eq('id', id); if (error) return toast('Erro: ' + error.message); }
  e.data_devolucao_prevista = nd; renderizarEmprestimos(); toast('Renovado até ' + fmt(nd + 'T12:00:00'));
}
window.devolverEmprestimo = async id => {
  if (!await confirmarAcao('Confirmar devolução?', 'O exemplar voltará a ficar disponível.', 'Devolver')) return;
  if (supabaseClient) await supabaseClient.from('emprestimos').update({ status: 'Devolvido' }).eq('id', id); else listaEmprestimos = listaEmprestimos.filter(x => +x.id !== +id);
  await carregarEmprestimos(); empResumo(); toast('Devolução concluída!');
};
function initEmp() {
  if (!$('#formEmprestimo')) return;
  $('#empBuscaLivro').oninput = () => sugerir($('#empBuscaLivro'), $('#empSugLivro'), ativos(), { busca: l => `${tit(l)} ${aut(l)} ${l.numero_tombo || ''}`, item: l => `<b>${esc(tit(l))}</b><small>${esc(aut(l))} • ${esc(l.numero_tombo || 's/ tombo')}</small>` }, l => livroEmp = l);
  $('#empBuscaUsr').oninput = () => sugerir($('#empBuscaUsr'), $('#empSugUsr'), listaUsuarios || [], { busca: u => `${u.nome} ${u.email || ''} ${u.usuario || ''}`, item: u => `<b>${esc(u.nome)}</b><small>${esc(u.email || '')}</small>` }, u => usrEmp = u);
  $('#empLivroSel').onclick = e => { if (e.target.closest('[data-x]')) { livroEmp = null; empResumo(); } }; $('#empUsrSel').onclick = e => { if (e.target.closest('[data-x]')) { usrEmp = null; empResumo(); } };
  $('#empPrazos').innerHTML = [7, 14, 21, 30].map(n => `<button type="button" class="chip" data-d="${n}">${n} dias</button>`).join(''); $('#empPrazos').onclick = e => { if (e.target.dataset.d) prazo(+e.target.dataset.d); };
  $('#dataDevolucaoPrevista').onchange = () => { $$('#empPrazos .chip').forEach(c => c.classList.remove('on')); empResumo(); };
  $('#empFiltroQ').oninput = renderizarEmprestimos; $('#empChips').onclick = e => { if (e.target.dataset.f) { empFiltro = e.target.dataset.f; $$('#empChips .chip').forEach(c => c.classList.toggle('on', c === e.target)); renderizarEmprestimos(); } };
  $('#tabelaEmprestimosBody').onclick = e => { const b = e.target.closest('[data-a]'); if (b) (b.dataset.a === 'ren' ? renovar : devolverEmprestimo)(b.dataset.id); };
  prazo(14);
}

// ---------- Desbaste (arquivo na nuvem) ----------
const MOT = { espaco: ['Falta de espaço no acervo', 'fa-box-archive', '#64748b'], desatualizado: ['Desatualizado', 'fa-clock-rotate-left', '#f59e0b'], avariado: ['Avariado', 'fa-heart-crack', '#ef4444'], permuta: ['Permuta', 'fa-right-left', '#8b5cf6'], doacao: ['Doação', 'fa-hand-holding-heart', '#10b981'] };
let DES = [], desLocal = false, livroDes = null, motDes = '';
window.MOTIVOS_DESBASTE = MOT;
window.carregarDesbastesHub = async () => { await carregarDesbastes(); return DES; };
async function carregarDesbastes() {
  if (!supabaseClient) desLocal = true;
  if (!desLocal) { const { data, error } = await supabaseClient.from('desbastes').select('*').order('created_at', { ascending: false }); if (!error) { DES = data || []; return; } desLocal = true; }
  try { DES = JSON.parse(localStorage.getItem('venous_desbastes')) || []; } catch (_) { DES = []; }
}
const salvarDes = () => { try { localStorage.setItem('venous_desbastes', JSON.stringify(DES)); } catch (_) {} };
function desBuscar() {
  const box = $('#desResultados'); if (!box) return; const q = $('#desBusca').value.trim().toLowerCase();
  if (q.length < 2) { box.innerHTML = '<small class="muted">Digite título, autor ou tombo para localizar o livro.</small>'; return; }
  const r = ativos().filter(l => `${tit(l)} ${aut(l)} ${l.numero_tombo || ''}`.toLowerCase().includes(q)).slice(0, 8);
  box.innerHTML = r.length ? r.map(l => `<div class="des-item">${capaHtml(l)}<div class="i"><b>${esc(tit(l))}</b><small>${esc(aut(l))} • Tombo ${esc(l.numero_tombo || '—')}</small></div><button class="btn btn-outline btn-sm" data-des="${l.id}"><i class="fa-solid fa-cloud-arrow-up"></i> Desbastar</button></div>`).join('') : '<small class="muted">Nenhum livro ativo encontrado.</small>';
}
function abrirDes(id) {
  livroDes = ativos().find(l => +l.id === +id); if (!livroDes) return; motDes = ''; $('#desDestino').value = ''; $('#desObs').value = '';
  $('#desLivro').innerHTML = `<div class="des-item">${capaHtml(livroDes)}<div class="i"><b>${esc(tit(livroDes))}</b><small>${esc(aut(livroDes))} • Tombo ${esc(livroDes.numero_tombo || '—')}</small></div></div>`;
  $('#desMotivos').innerHTML = Object.entries(MOT).map(([k, [n, i, c]]) => `<button type="button" class="mot" data-m="${k}" style="--c:${c}"><i class="fa-solid ${i}"></i> ${n}</button>`).join(''); updDes(); $('#modalDesbaste').classList.add('active');
}
function updDes() {
  $$('#desMotivos .mot').forEach(b => b.classList.toggle('on', b.dataset.m === motDes));
  const dest = motDes === 'permuta' || motDes === 'doacao'; $('#desDestinoBox').classList.toggle('hidden', !dest);
  $('#desDestinoLbl').textContent = motDes === 'permuta' ? 'Permuta com quem / qual instituição? *' : 'Doado para onde / quem recebeu? *';
  $('#desObsReq').textContent = motDes === 'avariado' ? '* (descreva o dano)' : '(opcional)'; $('#desObsCnt').textContent = $('#desObs').value.length + '/400';
  $('#desConfirma').disabled = !motDes || (dest && !$('#desDestino').value.trim()) || (motDes === 'avariado' && !$('#desObs').value.trim());
}
async function confirmarDesbaste() {
  const l = livroDes; if (!l || !motDes) return; const btn = $('#desConfirma'); btn.disabled = true;
  const reg = { livro_id: l.id, tombo: l.numero_tombo || '', titulo: tit(l), autor: aut(l), cdd: l.classificacao_cdd || '', capa_url: l.capa_url || null, motivo: motDes, destino: (motDes === 'permuta' || motDes === 'doacao') ? $('#desDestino').value.trim() : null, observacao: $('#desObs').value.trim() || null, responsavel: usuarioAtual.nome, responsavel_id: usuarioAtual.id, status: 'desbastado' };
  if (!desLocal) {
    const { data, error } = await supabaseClient.from('desbastes').insert([reg]).select().single(); if (error) { btn.disabled = false; return toast('Erro ao arquivar: ' + error.message, 'erro'); }
    DES.unshift(data); const r = await supabaseClient.from('acervo').update({ em_lixeira: true }).eq('id', l.id); if (r.error) toast('Registro salvo, mas o livro não saiu do acervo: ' + r.error.message, 'erro');
  } else { DES.unshift({ ...reg, id: Date.now(), created_at: new Date().toISOString() }); salvarDes(); }
  l.em_lixeira = true; $('#modalDesbaste').classList.remove('active'); renderDes(); desBuscar(); toast('Livro desbastado e arquivado na nuvem.');
}
function renderDes() {
  if (!$('#desBody')) return; const f = $('#desFMot').value, q = $('#desFQ').value.toLowerCase(), per = $('#desFPer').value, lim = per === 'todos' ? 0 : Date.now() - Number(per) * 864e5;
  const base = DES.filter(d => !lim || new Date(d.created_at) >= lim), val = base.filter(d => d.status !== 'revertido');
  $('#desStats').innerHTML = `<div class="kpi"><b>${val.length}</b><span>Desbastados no período</span></div>` + Object.entries(MOT).map(([k, [n, , c]]) => `<div class="kpi" style="border-left:4px solid ${c}"><b>${val.filter(d => d.motivo === k).length}</b><span>${n}</span></div>`).join('');
  const v = base.filter(d => (!f || d.motivo === f) && (!q || `${d.titulo} ${d.autor} ${d.tombo} ${d.destino || ''}`.toLowerCase().includes(q)));
  $('#desBody').innerHTML = v.length ? v.map(d => { const [n, , c] = MOT[d.motivo] || [d.motivo, '', '#64748b']; return `<tr><td data-label="Data">${fmt(d.created_at)}</td><td data-label="Livro"><b>${esc(d.titulo)}</b><br><small class="muted">${esc(d.autor || '')} • Tombo ${esc(d.tombo || '—')}</small></td><td data-label="Motivo"><span class="mb" style="--c:${c}">${n}</span>${d.status === 'revertido' ? ' <span class="st">Devolvido ao acervo</span>' : ''}</td><td data-label="Destino">${esc(d.destino || '—')}</td><td data-label="Observação" title="${esc(d.observacao || '')}">${esc((d.observacao || '—').slice(0, 90))}</td><td data-label="Responsável">${esc(d.responsavel || '—')}</td><td>${d.status !== 'revertido' && equipeAdmin() ? `<button class="btn btn-outline btn-sm" data-rev="${d.id}"><i class="fa-solid fa-rotate-left"></i> Devolver ao acervo</button>` : ''}</td></tr>`; }).join('') : '<tr><td colspan="7" class="muted" style="text-align:center">Nenhum registro de desbaste ainda.</td></tr>';
}
async function reverterDes(id) {
  const d = DES.find(x => String(x.id) === String(id)); if (!d || !await confirmarAcao('Devolver livro ao acervo?', 'O livro volta a ficar disponível; o registro fica marcado como "Devolvido ao acervo" e sai das estatísticas.', 'Devolver')) return;
  if (!desLocal) { await supabaseClient.from('desbastes').update({ status: 'revertido' }).eq('id', d.id); await supabaseClient.from('acervo').update({ em_lixeira: false }).eq('id', d.livro_id); }
  d.status = 'revertido'; salvarDes(); const l = (acervoCompleto || []).find(x => +x.id === +d.livro_id); if (l) l.em_lixeira = false; renderDes(); toast('Livro devolvido ao acervo.');
}
function exportarDes() {
  const c = s => `"${String(s ?? '').replace(/"/g, '""')}"`, rows = [['Data', 'Tombo', 'Título', 'Autor', 'CDD', 'Motivo', 'Destino', 'Observação', 'Responsável', 'Status'], ...DES.map(d => [fmt(d.created_at), d.tombo, d.titulo, d.autor, d.cdd, (MOT[d.motivo] || [d.motivo])[0], d.destino, d.observacao, d.responsavel, d.status])];
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob(['\ufeff' + rows.map(r => r.map(c).join(';')).join('\n')], { type: 'text/csv' })), download: 'desbastes.csv' }); a.click(); URL.revokeObjectURL(a.href);
}
function initDes() {
  if (!$('#desBody')) return;
  $('#desBusca').oninput = desBuscar; $('#desResultados').onclick = e => { const b = e.target.closest('[data-des]'); if (b) abrirDes(b.dataset.des); };
  $('#desMotivos').onclick = e => { const b = e.target.closest('[data-m]'); if (b) { motDes = b.dataset.m; updDes(); } };
  $('#desDestino').oninput = $('#desObs').oninput = updDes; $('#desConfirma').onclick = confirmarDesbaste; $('#desExport').onclick = exportarDes;
  [$('#desFMot'), $('#desFQ'), $('#desFPer')].forEach(e => e.oninput = renderDes); $('#desBody').onclick = e => { const b = e.target.closest('[data-rev]'); if (b) reverterDes(b.dataset.rev); };
}
document.addEventListener('DOMContentLoaded', () => {
  initEmp(); initDes();
  $$('#hubCat [data-sub]').forEach(b => b.onclick = e => trocarSubAbaCatalogacao(b.dataset.sub, e));
  if ($('#hubCat')) { trocarSubAbaCatalogacao(location.hash.slice(1) || 'planilha'); window.addEventListener('hashchange', () => trocarSubAbaCatalogacao(location.hash.slice(1))); }
});
})();
