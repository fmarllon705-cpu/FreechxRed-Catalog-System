// Venous • Gestão (usuários, relatórios, mensagens) e Suporte
(() => {
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)], esc = v => escaparHTML(v), toast = (...a) => window.hubToast(...a);
const sb = () => (typeof supabaseClient !== 'undefined' ? supabaseClient : null), fmt = d => d ? new Date(d).toLocaleDateString('pt-BR') : '-';
const CAT = { duvida: ['Dúvida', 'fa-circle-question'], problema: ['Problema técnico', 'fa-bug'], sugestao: ['Sugestão', 'fa-lightbulb'], doacao: ['Doação / permuta', 'fa-hand-holding-heart'], conta: ['Minha conta', 'fa-user-lock'] };

// ---------- Mensagens de suporte (Supabase com fallback local) ----------
let MSG = [], msgLocal = false;
async function carregarMsgs() {
  if (!sb()) msgLocal = true;
  if (!msgLocal) { const { data, error } = await sb().from('suporte_mensagens').select('*').order('created_at', { ascending: false }); if (!error) { MSG = data || []; return; } msgLocal = true; }
  try { MSG = JSON.parse(localStorage.getItem('venous_suporte')) || []; } catch (_) { MSG = []; }
}
const salvarMsgs = () => { try { localStorage.setItem('venous_suporte', JSON.stringify(MSG)); } catch (_) {} };
const logado = () => typeof usuarioAtual !== 'undefined' && usuarioAtual && usuarioAtual.nome !== 'Visitante (Público)';

// ---------- Suporte: formulário ----------
let cat = '';
function validarSup() {
  const v = id => $(id).value.trim(), erro = {};
  if (!cat) erro.cat = 1; if (v('#supAssunto').length < 4) erro.supAssunto = 'Informe um assunto (mín. 4 letras).'; if (v('#supMsg').length < 15) erro.supMsg = 'Descreva melhor (mín. 15 caracteres).';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v('#supEmail'))) erro.supEmail = 'E-mail inválido.'; if (v('#supNome').length < 2) erro.supNome = 'Informe seu nome.';
  $$('.pre-msg[data-for]').forEach(m => m.textContent = ($('#' + m.dataset.for).value ? erro[m.dataset.for] : '') || ''); $('#supCnt').textContent = $('#supMsg').value.length + '/1000';
  $('#btnSup').disabled = !!Object.keys(erro).length; return !Object.keys(erro).length;
}
async function enviarSup(e) {
  e.preventDefault(); if (!validarSup()) return; const btn = $('#btnSup'); btn.disabled = true; btn.textContent = 'Enviando…';
  const m = { usuario_id: logado() ? usuarioAtual.id : null, nome: $('#supNome').value.trim(), email: $('#supEmail').value.trim(), categoria: cat, assunto: $('#supAssunto').value.trim(), mensagem: $('#supMsg').value.trim(), status: 'aberto', resposta: null };
  if (!msgLocal) { const { data, error } = await sb().from('suporte_mensagens').insert([m]).select().single(); if (error) { msgLocal = true; } else MSG.unshift(data); }
  if (msgLocal) { MSG.unshift({ ...m, id: Date.now(), created_at: new Date().toISOString() }); salvarMsgs(); }
  $('#formSuporte').classList.add('hidden'); $('#supOk').classList.remove('hidden'); listarMinhas();
}
function listarMinhas() {
  const box = $('#minhasMsgs'); if (!box) return; const mine = MSG.filter(m => logado() && +m.usuario_id === +usuarioAtual.id);
  box.innerHTML = mine.length ? mine.map(m => `<div class="msg-card"><header><b>${esc(m.assunto)}</b><span class="st ${m.status === 'resolvido' ? 'Concluida' : 'Pendente'}">${m.status === 'resolvido' ? 'Respondida' : 'Em análise'}</span></header><small class="muted">${esc((CAT[m.categoria] || [m.categoria])[0])} • ${fmt(m.created_at)}</small><p style="margin-top:6px;font-size:.88rem">${esc(m.mensagem)}</p>${m.resposta ? `<div class="resp"><b>Resposta da equipe:</b> ${esc(m.resposta)}</div>` : ''}</div>`).join('') : `<p class="muted" style="font-size:.88rem">${logado() ? 'Você ainda não enviou mensagens.' : 'Entre na sua conta para acompanhar suas mensagens.'}</p>`;
}
async function iniciarSuporte() {
  if (!$('#formSuporte')) return; await carregarMsgs();
  $('#supCats').innerHTML = Object.entries(CAT).map(([k, [n, i]]) => `<button type="button" class="chip" data-c="${k}"><i class="fa-solid ${i}"></i> ${n}</button>`).join('');
  $('#supCats').onclick = e => { const b = e.target.closest('[data-c]'); if (b) { cat = b.dataset.c; $$('#supCats .chip').forEach(c => c.classList.toggle('on', c === b)); validarSup(); } };
  const pre = () => { if (logado()) { $('#supNome').value = usuarioAtual.nome; $('#supEmail').value = usuarioAtual.email || ''; } validarSup(); listarMinhas(); };
  $('#formSuporte').oninput = validarSup; $('#formSuporte').onsubmit = enviarSup; $('#supNovo').onclick = () => { $('#formSuporte').reset(); cat = ''; $$('#supCats .chip').forEach(c => c.classList.remove('on')); $('#formSuporte').classList.remove('hidden'); $('#supOk').classList.add('hidden'); $('#btnSup').textContent = 'Enviar mensagem'; pre(); };
  const t = setInterval(pre, 400); setTimeout(() => clearInterval(t), 4000); pre();
}

// ---------- Gestão: abas ----------
const GP = { usuarios: 'gpUsuarios', relatorios: 'gpRelatorios', mensagens: 'gpMensagens' };
function aba(n) {
  if (!GP[n]) n = 'usuarios'; Object.entries(GP).forEach(([k, id]) => { const e = document.getElementById(id); if (e) e.style.display = k === n ? 'block' : 'none'; });
  $$('#hubGestao [data-gp]').forEach(b => b.setAttribute('aria-selected', b.dataset.gp === n)); history.replaceState(null, '', '#' + n);
  if (n === 'relatorios') relatorios(); if (n === 'mensagens') inbox();
}
async function inbox() {
  await carregarMsgs(); const f = $('#msgFiltro').value, v = MSG.filter(m => !f || m.status === f), ab = MSG.filter(m => m.status === 'aberto').length;
  $('#msgBadge').textContent = ab || ''; $('#msgBadge').classList.toggle('hidden', !ab);
  $('#msgLista').innerHTML = v.length ? v.map(m => `<div class="msg-card" data-id="${m.id}"><header><span><b>${esc(m.assunto)}</b> <span class="st">${esc((CAT[m.categoria] || [m.categoria])[0])}</span></span><span class="st ${m.status === 'resolvido' ? 'Concluida' : 'Pendente'}">${m.status === 'resolvido' ? 'Resolvida' : 'Aberta'}</span></header><small class="muted">${esc(m.nome)} • ${esc(m.email)} • ${fmt(m.created_at)}</small><p style="margin:6px 0;font-size:.9rem;overflow-wrap:anywhere">${esc(m.mensagem)}</p>${m.status === 'resolvido' ? `<div class="resp"><b>Resposta:</b> ${esc(m.resposta || '—')}</div>` : `<textarea rows="2" placeholder="Resposta ao usuário (opcional)"></textarea><button class="btn btn-primary btn-sm" data-res="${m.id}" style="margin-top:6px"><i class="fa-solid fa-check"></i> Marcar como resolvida</button>`}</div>`).join('') : '<div class="hint">Nenhuma mensagem por aqui.</div>';
}
async function resolver(id, card) {
  const r = card.querySelector('textarea').value.trim(), m = MSG.find(x => String(x.id) === String(id)); if (!m) return;
  if (!msgLocal) { const { error } = await sb().from('suporte_mensagens').update({ status: 'resolvido', resposta: r || null }).eq('id', id); if (error) return toast('Erro: ' + error.message); }
  m.status = 'resolvido'; m.resposta = r || null; salvarMsgs(); inbox(); toast('Mensagem resolvida.');
}

// ---------- Relatórios ----------
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const parse = s => { if (!s) return null; const m = String(s).match(/^(\d{2})\/(\d{2})\/(\d{4})/), d = m ? new Date(+m[3], +m[2] - 1, +m[1]) : new Date(s); return isNaN(d) ? null : d; };
const chave = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const meses = n => Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (n - 1 - i)); return chave(d); });
const serie = (its, get, ms) => { const c = Object.fromEntries(ms.map(m => [m, 0])); its.forEach(i => { const d = parse(get(i)); if (d && chave(d) in c) c[chave(d)]++; }); return ms.map(m => [m, c[m]]); };
const rot = k => MES[+k.slice(5) - 1] + (k.slice(5) === '01' ? '/' + k.slice(2, 4) : '');
const barras = (t, d, cor) => { const mx = Math.max(1, ...d.map(x => x[1])); return `<div class="box"><h4>${t}</h4><div class="bars">${d.map(([k, v]) => `<div class="bar" title="${k}: ${v}"><i style="height:${v / mx * 100}%;background:${cor}"></i><b>${v || ''}</b><span>${rot(k)}</span></div>`).join('')}</div></div>`; };
const hbarras = (t, d) => { const mx = Math.max(1, ...d.map(x => x[1])); return `<div class="box"><h4>${t}</h4>${d.map(([n, v, c]) => `<div class="hb"><span>${n}</span><div><i style="width:${v / mx * 100}%;background:${c}"></i></div><b>${v}</b></div>`).join('') || '<small class="muted">Sem dados.</small>'}</div>`; };
let REL = null;
async function relatorios() {
  const n = +$('#relPer').value, ms = meses(n), cut = new Date(); cut.setMonth(cut.getMonth() - n); await Promise.all([Promise.resolve(window.appReady)]);
  let emp = [], posts = []; if (sb()) { try { emp = (await sb().from('emprestimos').select('data_emprestimo,status')).data || []; } catch (_) {} } else emp = listaEmprestimos || [];
  const des = window.carregarDesbastesHub ? await window.carregarDesbastesHub() : []; const MOT = window.MOTIVOS_DESBASTE || {};
  try { if (!sb()) throw 0; const r = await sb().from('feed_posts').select('id,created_at'); if (r.error) throw 0; posts = r.data || []; } catch (_) { try { posts = JSON.parse(localStorage.getItem('venous_feed_local')) || []; } catch (e) { posts = []; } }
  const livros = (acervoCompleto || []).filter(l => !l.em_lixeira), us = listaUsuarios || [], res = listaReservas || [], dv = des.filter(d => d.status !== 'revertido');
  const dataL = l => l.data_aquisicao || l.created_at, noPer = d => { const x = parse(d); return x && x >= cut; };
  const entradas = serie(livros, dataL, ms), novos = serie(us, u => u.created_at, ms), emps = serie(emp, e => e.data_emprestimo, ms), desm = serie(dv, d => d.created_at, ms);
  const atraso = (listaEmprestimos || []).filter(e => e.data_devolucao_prevista && new Date(String(e.data_devolucao_prevista).slice(0, 10) + 'T23:59:59') < new Date()).length;
  const kp = [['Títulos no acervo', livros.length], ['Exemplares', livros.reduce((s, l) => s + (Number(l.exemplares) || 1), 0)], ['Entradas no período', livros.filter(l => noPer(dataL(l))).length], ['Usuários', us.length], ['Empréstimos no período', emp.filter(e => noPer(e.data_emprestimo)).length], ['Atrasados agora', atraso, 'warn'], ['Reservas pendentes', res.filter(r => r.status === 'Pendente').length], ['Desbastados no período', dv.filter(d => noPer(d.created_at)).length], ['Posts no feed', posts.length]];
  const cargos = Object.entries(us.reduce((a, u) => (a[u.cargo || 'usuario'] = (a[u.cargo || 'usuario'] || 0) + 1, a), {})).map(([k, v]) => [k, v, '#0369a1']);
  const stR = Object.entries(res.reduce((a, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {})).map(([k, v]) => [k, v, { Pendente: '#f59e0b', Concluida: '#10b981', Cancelada: '#ef4444' }[k] || '#64748b']);
  const mot = Object.entries(MOT).map(([k, [nm, , c]]) => [nm, dv.filter(d => d.motivo === k).length, c]);
  REL = { kp, entradas, novos, emps, desm, mot, cargos, stR };
  $('#relConteudo').innerHTML = `<div class="kpis">${kp.map(([l, v, w]) => `<div class="kpi ${w || ''}"><b>${v}</b><span>${l}</span></div>`).join('')}</div><div class="rep-grid">${barras('Entrada de livros por mês', entradas, '#0369a1')}${barras('Novos usuários por mês', novos, '#8b5cf6')}${barras('Empréstimos por mês', emps, '#10b981')}${barras('Livros desbastados por mês', desm, '#0ea5e9')}${hbarras('Desbaste por motivo', mot)}${hbarras('Reservas por situação', stR)}${hbarras('Usuários por cargo', cargos)}</div>${us.some(u => u.created_at) ? '' : '<div class="hint">Novos usuários por mês dependem da coluna <b>created_at</b> em usuarios_sistema.</div>'}`;
}
function exportarRel() {
  if (!REL) return; const c = s => `"${String(s).replace(/"/g, '""')}"`, rows = [['Indicador', 'Valor'], ...REL.kp.map(k => [k[0], k[1]]), [], ['Mês', 'Entradas', 'Novos usuários', 'Empréstimos', 'Desbastados'], ...REL.entradas.map(([m, v], i) => [m, v, REL.novos[i][1], REL.emps[i][1], REL.desm[i][1]]), [], ['Motivo de desbaste', 'Quantidade'], ...REL.mot.map(m => [m[0], m[1]])];
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob(['\ufeff' + rows.map(r => r.map(c).join(';')).join('\n')], { type: 'text/csv' })), download: 'relatorio-venous.csv' }); a.click(); URL.revokeObjectURL(a.href);
}
document.addEventListener('DOMContentLoaded', () => {
  iniciarSuporte();
  if ($('#hubGestao')) {
    $$('#hubGestao [data-gp]').forEach(b => b.onclick = () => aba(b.dataset.gp)); $('#relPer').onchange = relatorios; $('#msgFiltro').onchange = inbox; $('#relExport').onclick = exportarRel;
    $('#msgLista').onclick = e => { const b = e.target.closest('[data-res]'); if (b) resolver(b.dataset.res, b.closest('.msg-card')); };
    aba(location.hash.slice(1)); window.addEventListener('hashchange', () => aba(location.hash.slice(1))); carregarMsgs().then(() => { const ab = MSG.filter(m => m.status === 'aberto').length; $('#msgBadge').textContent = ab || ''; $('#msgBadge').classList.toggle('hidden', !ab); });
  }
});
})();
