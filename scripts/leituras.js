// Venous • Leituras: estante (acervo + livros externos), progresso diário de páginas, estatísticas e publicação no feed.
(() => {
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)], esc = v => escaparHTML(v), pad = n => String(n).padStart(2, '0');
const MA = () => window.MinhaArea, eu = () => MA().eu(), toast = (...a) => MA().toast(...a);
const dia = d => { const x = new Date(d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
const STICKERS = ['📚', '📖', '🔥', '😍', '🤯', '😱', '😭', '🥹', '👏', '🎉', '⭐', '💯', '☕', '🌙', '🧠', '👻', '💀', '❤️', '😴', '🤔', '🙌', '🏆', '📝', '🔖'];
let LEIT = [], HIST = [], local = false, carregado = false, aba = 'lendo';

// ---------- Dados (Supabase com fallback local) ----------
const LK = () => `venous_leituras_${eu().id}`, HK = () => `venous_hist_${eu().id}`;
async function carregar() {
  const sb = window.supabaseClient; if (!sb) local = true;
  if (!local) { const a = await sb.from('leituras_usuario').select('*').eq('usuario_id', eu().id).order('created_at', { ascending: false }), b = await sb.from('historico_paginas').select('*').eq('usuario_id', eu().id).order('registrado_em', { ascending: false }); if (!a.error && !b.error) { LEIT = a.data || []; HIST = b.data || []; carregado = true; return; } local = true; }
  try { LEIT = JSON.parse(localStorage.getItem(LK())) || []; HIST = JSON.parse(localStorage.getItem(HK())) || []; } catch (_) { LEIT = []; HIST = []; } carregado = true;
}
const salvarLocal = () => { try { localStorage.setItem(LK(), JSON.stringify(LEIT)); localStorage.setItem(HK(), JSON.stringify(HIST)); } catch (_) { toast('Armazenamento local cheio.', 'erro'); } };
async function criar(l) {
  l.usuario_id = eu().id; if (local) { const n = { ...l, id: Date.now(), created_at: new Date().toISOString() }; LEIT.unshift(n); salvarLocal(); return n; }
  const { data, error } = await window.supabaseClient.from('leituras_usuario').insert([l]).select().single(); if (error) { toast('Erro ao salvar: ' + error.message, 'erro'); return null; } LEIT.unshift(data); return data;
}
async function atualizar(l, campos) { Object.assign(l, campos); if (local) return salvarLocal(); const { error } = await window.supabaseClient.from('leituras_usuario').update(campos).eq('id', l.id); if (error) toast('Erro: ' + error.message, 'erro'); }
async function registrarHist(l, antes, depois) {
  const h = { leitura_id: l.id, usuario_id: eu().id, pagina_anterior: antes, pagina_atual: depois, paginas_lidas: Math.max(0, depois - antes), registrado_em: new Date().toISOString() };
  if (local) { HIST.unshift({ ...h, id: Date.now() }); return salvarLocal(); }
  const { data, error } = await window.supabaseClient.from('historico_paginas').insert([h]).select().single(); if (error) return toast('Erro no histórico: ' + error.message, 'erro'); HIST.unshift(data);
}
async function remover(l) {
  if (!await confirmarAcao('Remover da estante?', 'O histórico de páginas deste livro também será apagado.', 'Remover')) return;
  if (!local) await window.supabaseClient.from('leituras_usuario').delete().eq('id', l.id);
  LEIT = LEIT.filter(x => x !== l); HIST = HIST.filter(h => +h.leitura_id !== +l.id); if (local) salvarLocal(); render();
}

// ---------- Estatísticas ----------
function stats() {
  const porDia = {}; HIST.forEach(h => { const k = dia(h.registrado_em); porDia[k] = (porDia[k] || 0) + Math.max(0, h.paginas_lidas || 0); });
  const hoje = dia(Date.now()), ontem = dia(Date.now() - 864e5), n = new Date(), y = n.getFullYear(), m = pad(n.getMonth() + 1);
  const inicio = { semana: dia(Date.now() - 6 * 864e5), mes: `${y}-${m}-01`, semestre: n.getMonth() < 6 ? `${y}-01-01` : `${y}-07-01`, ano: `${y}-01-01` };
  const soma = d => Object.entries(porDia).filter(([k]) => k >= d).reduce((s, [, v]) => s + v, 0), lidos = d => LEIT.filter(l => l.status === 'lido' && l.concluido_em && dia(l.concluido_em) >= d).length;
  let streak = 0; const c = new Date(); if (!porDia[dia(c)]) c.setDate(c.getDate() - 1); while (porDia[dia(c)] > 0) { streak++; c.setDate(c.getDate() - 1); }
  const serie = Array.from({ length: 14 }, (_, i) => { const d = new Date(Date.now() - (13 - i) * 864e5); return [dia(d), porDia[dia(d)] || 0, d.getDate()]; });
  return { porDia, hoje: porDia[hoje] || 0, ontem: porDia[ontem] || 0, semana: soma(inicio.semana), mes: soma(inicio.mes), semestre: soma(inicio.semestre), ano: soma(inicio.ano), media: soma(dia(Date.now() - 29 * 864e5)) / 30, streak, lidosMes: lidos(inicio.mes), lidosSem: lidos(inicio.semestre), lidosAno: lidos(inicio.ano), serie };
}
const pct = l => l.total_paginas ? Math.min(100, Math.round(((l.pagina_atual || 0) / l.total_paginas) * 100)) : (l.status === 'lido' ? 100 : 0);
const paginasHojeDoLivro = l => HIST.filter(h => +h.leitura_id === +l.id && dia(h.registrado_em) === dia(Date.now())).reduce((s, h) => s + Math.max(0, h.paginas_lidas || 0), 0);

// ---------- Renderização ----------
const capaHtml = l => l.capa_url ? `<img class="cv" src="${esc(l.capa_url)}" alt="" onerror="this.style.visibility='hidden'">` : '<div class="cv"><i class="fa-solid fa-book"></i></div>';
function render() {
  if (!$('#rdLista')) return; if (!carregado) { carregar().then(render); return; }
  const s = stats(), seta = s.hoje > s.ontem ? '▲' : s.hoje < s.ontem ? '▼' : '=';
  $('#rdKpis').innerHTML = [[s.lidosMes, 'Livros lidos no mês'], [s.lidosSem, 'Livros lidos no semestre'], [s.lidosAno, 'Livros lidos no ano'], [s.hoje, `Páginas hoje ${seta}`], [s.ontem, 'Páginas ontem'], [Math.round(s.media), 'Média de páginas/dia (30 dias)'], [s.streak, 'Dias seguidos lendo 🔥']].map(([v, l]) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join('');
  const mx = Math.max(1, ...s.serie.map(x => x[1]));
  $('#rdBars').innerHTML = `<div class="rd-bars">${s.serie.map(([k, v, d]) => `<div class="bar" title="${k}: ${v} páginas"><i style="height:${v / mx * 100}%"></i><b>${v || ''}</b><span>${d}</span></div>`).join('')}</div>`;
  $('#rdPeriodos').innerHTML = [['Hoje', s.hoje], ['Ontem', s.ontem], ['Últimos 7 dias', s.semana], ['Este mês', s.mes], ['Este semestre', s.semestre], ['Este ano', s.ano]].map(([n, v]) => `<div class="mini"><span class="i">${n}</span><b>${v} pág.</b></div>`).join('');
  const cont = st => LEIT.filter(l => l.status === st).length;
  $('#rdAbas').innerHTML = [['lendo', 'Lendo agora'], ['lido', 'Lidos'], ['quero', 'Quero ler']].map(([k, n]) => `<button class="chip${aba === k ? ' on' : ''}" data-aba="${k}">${n} (${cont(k)})</button>`).join('');
  const v = LEIT.filter(l => l.status === aba);
  $('#rdLista').innerHTML = v.length ? v.map(l => `<div class="rd-card" data-id="${l.id}">${capaHtml(l)}<div class="i"><b>${esc(l.titulo)}</b><small class="muted">${esc(l.autor || '')}${l.origem === 'externo' ? ' • livro externo' : ''}</small>
    ${l.status !== 'quero' ? `<div class="rd-prog"><i style="width:${pct(l)}%"></i></div><small>${l.total_paginas ? `pág. ${l.pagina_atual || 0} de ${l.total_paginas} • ${pct(l)}%` : `pág. ${l.pagina_atual || 0}`}</small>` : ''}
    <div class="rd-act">${l.status === 'lendo' ? `<input type="number" inputmode="numeric" min="0" placeholder="Parei na pág." data-pg="${l.id}"><button class="btn btn-primary btn-sm" data-a="pg">Atualizar</button><button class="btn btn-outline btn-sm" data-a="fim">Concluir</button>` : ''}${l.status === 'quero' ? '<button class="btn btn-primary btn-sm" data-a="ini">Começar a ler</button>' : ''}<button class="btn btn-outline btn-sm" data-a="pub"><i class="fa-solid fa-share-nodes"></i> Publicar no feed</button><button class="btn btn-outline btn-sm" data-a="rm" aria-label="Remover"><i class="fa-solid fa-trash"></i></button></div></div></div>`).join('')
    : `<div class="empty"><i class="fa-solid fa-book-open-reader"></i>${aba === 'lendo' ? 'Você não está lendo nenhum livro agora.' : aba === 'lido' ? 'Nenhum livro concluído ainda.' : 'Sua lista de “quero ler” está vazia.'}<br>Toque em “Adicionar livro” para começar.</div>`;
}

// ---------- Ações de leitura ----------
async function atualizarPagina(l, valor) {
  let nova = Math.max(0, Math.floor(Number(valor))); if (isNaN(nova)) return toast('Informe a página.', 'erro'); if (l.total_paginas) nova = Math.min(nova, l.total_paginas);
  const antes = l.pagina_atual || 0; if (nova === antes) return toast('Essa é a mesma página de antes.');
  await registrarHist(l, antes, nova); await atualizar(l, { pagina_atual: nova });
  const fim = l.total_paginas && nova >= l.total_paginas; if (fim) await atualizar(l, { status: 'lido', concluido_em: new Date().toISOString() });
  render(); resumo(l, Math.max(0, nova - antes), antes, nova, !!fim);
}
async function concluir(l) { const antes = l.pagina_atual || 0, total = l.total_paginas || antes; if (total > antes) await registrarHist(l, antes, total); await atualizar(l, { status: 'lido', pagina_atual: total, concluido_em: new Date().toISOString() }); render(); resumo(l, Math.max(0, total - antes), antes, total, true); }
const abrirModal = (html, cls) => { let m = $('#modalLeituras'); if (!m) { m = document.createElement('div'); m.id = 'modalLeituras'; m.className = 'modal-overlay'; document.body.appendChild(m); m.onclick = e => { if (e.target === m) fechar(); }; } m.innerHTML = `<div class="modal-box ${cls || ''}"><span class="close-modal" id="rdFechar">&times;</span>${html}</div>`; m.classList.add('active'); $('#rdFechar').onclick = fechar; return m; };
const fechar = () => $('#modalLeituras')?.classList.remove('active');
function resumo(l, lidas, antes, depois, fim) {
  const hoje = paginasHojeDoLivro(l);
  abrirModal(`<h3>${fim ? '🎉 Livro concluído!' : '📖 Progresso registrado'}</h3><div class="rd-sum">${capaHtml(l)}<div><b>${esc(l.titulo)}</b><br><small class="muted">${esc(l.autor || '')}</small>
    <p style="margin:8px 0"><b>${antes} → ${depois}</b> = <b>${lidas}</b> página(s) lidas agora.</p><p class="muted" style="font-size:.85rem">${hoje} página(s) deste livro hoje • ${pct(l)}% concluído</p><div class="rd-prog"><i style="width:${pct(l)}%"></i></div></div></div>
    <div class="btn-group" style="margin-top:16px;justify-content:flex-end"><button class="btn btn-outline" id="rdOk">Fechar</button><button class="btn btn-primary" id="rdPubBtn"><i class="fa-solid fa-share-nodes"></i> Publicar no Feed</button></div>`);
  $('#rdOk').onclick = fechar; $('#rdPubBtn').onclick = () => abrirPublicar(l, fim);
}

// ---------- Publicar no feed (comentário + figurinha/GIF) ----------
async function buscarGifs(q) {
  const k = window.VenousTema?.config().giphy_key; if (!k) return null;
  try { const r = await fetch(`https://api.giphy.com/v1/gifs/${q ? 'search' : 'trending'}?api_key=${encodeURIComponent(k)}&limit=18&rating=g${q ? '&q=' + encodeURIComponent(q) : ''}`), j = await r.json(); return (j.data || []).map(g => ({ prev: g.images.fixed_height_small.url, url: g.images.fixed_height.url })); } catch (_) { return []; }
}
function abrirPublicar(l, fim) {
  let sticker = '', gif = ''; const temKey = !!window.VenousTema?.config().giphy_key, hoje = paginasHojeDoLivro(l);
  abrirModal(`<h3><i class="fa-solid fa-share-nodes"></i> Publicar no feed</h3>
    <div class="prog-card">${capaHtml(l)}<div class="i"><b>${esc(l.titulo)}</b><small>${esc(l.autor || '')}</small><div class="rd-prog"><i style="width:${pct(l)}%"></i></div><div class="prog-st"><span>${fim ? 'Concluído 🎉' : pct(l) + '% concluído'}</span><span>${hoje} pág. hoje</span><span>~${Math.round(stats().media)} pág/dia</span></div></div></div>
    <div class="field" style="margin-top:12px"><label for="pbTxt">Comentário ou resenha (opcional)</label><textarea id="pbTxt" rows="3" maxlength="350" placeholder="O que você está achando? Sem spoilers 😉"></textarea></div>
    <div class="tabs" id="pbTabs" style="margin-bottom:8px"><button type="button" data-t="st" aria-selected="true">Figurinhas</button><button type="button" data-t="gif" aria-selected="false">GIFs</button></div>
    <div id="pbSt" class="stk">${STICKERS.map(s => `<button type="button" data-s="${s}">${s}</button>`).join('')}</div>
    <div id="pbGif" class="hidden">${temKey ? '<input id="pbQ" type="search" placeholder="Buscar GIFs…"><div id="pbGrid" class="gifs"></div>' : '<div class="hint"><i class="fa-solid fa-circle-info"></i> A busca de GIFs fica ativa quando o bibliotecário informa a chave do Giphy em Gestão › Personalização. Você pode colar o link de um GIF:</div>'}<input id="pbLink" placeholder="Cole um link https:// de GIF ou imagem" style="margin-top:8px"></div>
    <div id="pbSel" class="muted" style="margin:8px 0;font-size:.82rem"></div>
    <div class="btn-group" style="justify-content:flex-end"><button class="btn btn-outline" id="pbCancel">Cancelar</button><button class="btn btn-primary" id="pbOk"><i class="fa-solid fa-paper-plane"></i> Publicar</button></div>`, 'rd-wide');
  const sel = () => { $('#pbSel').textContent = [sticker && `Figurinha: ${sticker}`, gif && 'GIF selecionado'].filter(Boolean).join(' • '); $$('#pbSt button').forEach(b => b.classList.toggle('on', b.dataset.s === sticker)); };
  $('#pbTabs').onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; $$('#pbTabs button').forEach(x => x.setAttribute('aria-selected', x === b)); $('#pbSt').classList.toggle('hidden', b.dataset.t !== 'st'); $('#pbGif').classList.toggle('hidden', b.dataset.t !== 'gif'); if (b.dataset.t === 'gif' && temKey && !$('#pbGrid').children.length) gifs(''); };
  $('#pbSt').onclick = e => { const b = e.target.closest('[data-s]'); if (b) { sticker = sticker === b.dataset.s ? '' : b.dataset.s; sel(); } };
  const gifs = async q => { $('#pbGrid').innerHTML = '<small class="muted">Buscando…</small>'; const r = await buscarGifs(q); $('#pbGrid').innerHTML = r?.length ? r.map(g => `<button type="button" data-g="${esc(g.url)}"><img src="${esc(g.prev)}" alt="GIF"></button>`).join('') : '<small class="muted">Nenhum GIF encontrado.</small>'; };
  if (temKey) { let t; $('#pbQ').oninput = e => { clearTimeout(t); t = setTimeout(() => gifs(e.target.value.trim()), 450); }; $('#pbGrid').onclick = e => { const b = e.target.closest('[data-g]'); if (b) { gif = gif === b.dataset.g ? '' : b.dataset.g; sel(); } }; }
  $('#pbLink').oninput = e => { gif = /^https:\/\//i.test(e.target.value.trim()) ? e.target.value.trim() : ''; sel(); };
  $('#pbCancel').onclick = fechar;
  $('#pbOk').onclick = async () => { $('#pbOk').disabled = true; await publicar(l, { fim, sticker, gif, comentario: $('#pbTxt').value.trim() }); };
}
async function publicar(l, e) {
  const hoje = paginasHojeDoLivro(l), p = pct(l), resumoTxt = e.fim ? `Concluí a leitura de ${l.titulo}! 🎉` : `Li ${hoje} página${hoje === 1 ? '' : 's'} de ${l.titulo} hoje — ${p}% concluído`;
  const texto = [`${e.sticker ? e.sticker + ' ' : ''}${resumoTxt}`, e.comentario].filter(Boolean).join('\n\n').slice(0, 500);
  const prog = { titulo: l.titulo, autor: l.autor || '', capa: /^https:/.test(l.capa_url || '') ? l.capa_url : '', pagina_atual: l.pagina_atual || 0, total: l.total_paginas || 0, pct: p, paginas_hoje: hoje, ritmo: Math.round(stats().media), concluido: !!e.fim, sticker: e.sticker || '' };
  const ok = await MA().publicarPost({ tipo: e.fim ? 'resenha' : 'lendo', texto, livro_id: l.livro_id || null, livro_externo_titulo: l.livro_id ? null : l.titulo, livros: l.livro_id ? [{ id: l.livro_id }] : [{ ext: l.titulo }], midias: e.gif ? [e.gif] : [], progresso: prog });
  fechar(); if (ok) { toast('Publicado no feed!'); MA().aba('feed'); }
}

// ---------- Adicionar livro (acervo ou externo, com capa por API/câmera) ----------
async function buscarExterno(q) {
  q = q.trim(); if (q.length < 3) return []; const isbn = /^[\d\-xX]{10,17}$/.test(q) ? q.replace(/-/g, '') : '';
  try { const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${isbn ? 'isbn:' + isbn : encodeURIComponent(q)}&maxResults=8&printType=books`), j = await r.json();
    const a = (j.items || []).map(it => { const v = it.volumeInfo || {}, im = v.imageLinks || {}, c = (im.thumbnail || im.smallThumbnail || '').replace(/^http:/, 'https:').replace('&edge=curl', ''); return { titulo: v.title || '', autor: (v.authors || []).join(', '), total_paginas: v.pageCount || null, capa_url: c, isbn: (v.industryIdentifiers || [])[0]?.identifier || isbn }; });
    if (a.length) return a; } catch (_) {}
  try { const r = await fetch(`https://openlibrary.org/search.json?${isbn ? 'isbn=' + isbn : 'q=' + encodeURIComponent(q)}&limit=8&fields=title,author_name,number_of_pages_median,cover_i,isbn`), j = await r.json();
    return (j.docs || []).map(d => ({ titulo: d.title, autor: (d.author_name || []).join(', '), total_paginas: d.number_of_pages_median || null, capa_url: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : '', isbn: (d.isbn || [])[0] || isbn })); } catch (_) { return []; }
}
async function enviarCapa(file) {                                                    // foto/arquivo -> reduz -> Storage (fallback: imagem embutida)
  const url = await MA().lerImg(file, 600, .8, false);
  if (window.supabaseClient) { try { const blob = await (await fetch(url)).blob(), path = `${eu().id}/${Date.now()}.jpg`, { error } = await window.supabaseClient.storage.from('capas-leitura').upload(path, blob, { contentType: 'image/jpeg' }); if (!error) return window.supabaseClient.storage.from('capas-leitura').getPublicUrl(path).data.publicUrl; } catch (_) {} }
  return url;
}
function abrirAdd() {
  let modo = 'acervo', r = { origem: 'acervo', titulo: '', autor: '', capa_url: '', total_paginas: null, isbn: '', livro_id: null };
  abrirModal(`<h3><i class="fa-solid fa-circle-plus"></i> Adicionar à estante</h3>
    <div class="tabs" id="adTabs"><button type="button" data-m="acervo" aria-selected="true">Do acervo</button><button type="button" data-m="externo" aria-selected="false">Livro externo</button></div>
    <div id="adAcervo"><input id="adQa" type="search" placeholder="Buscar no acervo por título ou autor…"><div id="adResA" class="sugs"></div></div>
    <div id="adExterno" class="hidden"><div class="toolbar" style="margin-bottom:6px"><input id="adQe" type="search" placeholder="Título ou ISBN do livro…"><button class="btn btn-outline" id="adBuscar"><i class="fa-solid fa-magnifying-glass"></i> Buscar capa e dados</button></div><div id="adResE" class="sugs"></div></div>
    <div id="adForm" class="hidden"><div class="rd-sum"><div id="adCapa"></div><div style="flex:1;display:grid;gap:8px"><input id="adTit" placeholder="Título *" maxlength="150"><input id="adAut" placeholder="Autor" maxlength="120"><input id="adPag" type="number" inputmode="numeric" min="1" placeholder="Total de páginas"></div></div>
      <div id="adCapaAcoes" class="btn-group" style="margin:8px 0"><label class="btn btn-outline btn-sm"><i class="fa-solid fa-camera"></i> Tirar foto da capa<input type="file" accept="image/*" capture="environment" id="adCam" hidden></label><label class="btn btn-outline btn-sm"><i class="fa-solid fa-image"></i> Enviar imagem<input type="file" accept="image/*" id="adArq" hidden></label></div>
      <div class="cf-grid"><label class="cf"><span>Situação</span><select id="adSt"><option value="lendo">Lendo agora</option><option value="lido">Já li</option><option value="quero">Quero ler</option></select></label><label class="cf" id="adPgBox"><span>Página em que parou</span><input id="adPg" type="number" inputmode="numeric" min="0" value="0"></label><label class="cf hidden" id="adDtBox"><span>Concluí em</span><input id="adDt" type="date"></label></div>
      <div class="btn-group" style="justify-content:flex-end;margin-top:14px"><button class="btn btn-outline" id="adCancel">Cancelar</button><button class="btn btn-primary" id="adSalvar"><i class="fa-solid fa-check"></i> Adicionar</button></div></div>`, 'rd-wide');
  const form = () => { $('#adForm').classList.remove('hidden'); $('#adTit').value = r.titulo || ''; $('#adAut').value = r.autor || ''; $('#adPag').value = r.total_paginas || ''; capa(); $('#adDt').value = dia(Date.now()); };
  const capa = () => { $('#adCapa').innerHTML = r.capa_url ? `<img class="cv" style="width:70px;height:100px" src="${esc(r.capa_url)}" alt="" onerror="this.style.visibility='hidden'">` : '<div class="cv" style="width:70px;height:100px"><i class="fa-solid fa-camera"></i></div>'; $('#adCapaAcoes').classList.toggle('alerta', !r.capa_url && modo === 'externo'); };
  $('#adTabs').onclick = e => { const b = e.target.closest('[data-m]'); if (!b) return; modo = b.dataset.m; $$('#adTabs button').forEach(x => x.setAttribute('aria-selected', x === b)); $('#adAcervo').classList.toggle('hidden', modo !== 'acervo'); $('#adExterno').classList.toggle('hidden', modo !== 'externo'); if (modo === 'externo') { r = { origem: 'externo', titulo: '', autor: '', capa_url: '', total_paginas: null, isbn: '', livro_id: null }; form(); } else $('#adForm').classList.add('hidden'); };
  $('#adQa').oninput = e => { const q = e.target.value.trim().toLowerCase(), a = (typeof acervoCompleto !== 'undefined' ? acervoCompleto : []).filter(l => !l.em_lixeira && q && `${l.titulo_principal} ${l.nome_pessoal || ''}`.toLowerCase().includes(q)).slice(0, 6); $('#adResA').innerHTML = a.map(l => `<button type="button" class="pick" data-a="${l.id}"><b>${esc(l.titulo_principal)}</b><small>${esc(l.nome_pessoal || '')}</small></button>`).join('') || (q ? '<small class="muted">Nada encontrado no acervo.</small>' : ''); };
  $('#adResA').onclick = e => { const b = e.target.closest('[data-a]'); if (!b) return; const l = acervoCompleto.find(x => +x.id === +b.dataset.a); r = { origem: 'acervo', livro_id: l.id, titulo: l.titulo_principal, autor: l.nome_pessoal || '', capa_url: l.capa_url || '', total_paginas: Number(l.numero_paginas || l.paginas) || null, isbn: l.isbn || '' }; $('#adResA').innerHTML = ''; form(); };
  const buscar = async () => { $('#adResE').innerHTML = '<small class="muted">Buscando em Google Livros / Open Library…</small>'; const a = await buscarExterno($('#adQe').value); $('#adResE').innerHTML = a.length ? a.map((x, i) => `<button type="button" class="pick rd-res" data-i="${i}">${x.capa_url ? `<img class="cv" src="${esc(x.capa_url)}" alt="">` : '<div class="cv"><i class="fa-solid fa-book"></i></div>'}<span><b>${esc(x.titulo)}</b><small>${esc(x.autor)}${x.total_paginas ? ' • ' + x.total_paginas + ' págs.' : ''}</small></span></button>`).join('') : '<div class="hint">Não encontramos esse livro. Preencha os dados abaixo e envie uma foto da capa.</div>'; $('#adResE').__r = a; };
  $('#adBuscar').onclick = buscar; $('#adQe').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); buscar(); } };
  $('#adResE').onclick = e => { const b = e.target.closest('[data-i]'); if (!b) return; r = { ...r, ...$('#adResE').__r[+b.dataset.i], origem: 'externo', livro_id: null }; $('#adResE').innerHTML = ''; form(); };
  const foto = async e => { const f = e.target.files[0]; if (!f) return; try { r.capa_url = await enviarCapa(f); capa(); toast('Capa carregada.'); } catch (x) { toast(String(x.message || x), 'erro'); } e.target.value = ''; };
  $('#adCam').onchange = foto; $('#adArq').onchange = foto;
  $('#adSt').onchange = e => { $('#adPgBox').classList.toggle('hidden', e.target.value !== 'lendo'); $('#adDtBox').classList.toggle('hidden', e.target.value !== 'lido'); };
  $('#adCancel').onclick = fechar;
  $('#adSalvar').onclick = async () => {
    const titulo = $('#adTit').value.trim(); if (!titulo) return toast('Informe o título do livro.', 'erro'); const st = $('#adSt').value, total = Number($('#adPag').value) || null;
    const l = { origem: r.origem, livro_id: r.livro_id || null, titulo, autor: $('#adAut').value.trim(), isbn: r.isbn || null, total_paginas: total, capa_url: r.capa_url || null, status: st, pagina_atual: st === 'lendo' ? Math.max(0, Math.min(total || 1e9, Number($('#adPg').value) || 0)) : st === 'lido' ? total || 0 : 0, iniciado_em: st === 'quero' ? null : new Date().toISOString(), concluido_em: st === 'lido' ? new Date(($('#adDt').value || dia(Date.now())) + 'T12:00:00').toISOString() : null };
    const n = await criar(l); if (!n) return; aba = st; fechar(); render(); toast('Livro adicionado à estante.');
  };
}

function iniciar() {
  if (!$('#rdLista')) return;
  $('#rdAdd').onclick = abrirAdd; $('#rdAbas').onclick = e => { const b = e.target.closest('[data-aba]'); if (b) { aba = b.dataset.aba; render(); } };
  $('#rdLista').onclick = async e => { const b = e.target.closest('[data-a]'); if (!b) return; const card = b.closest('.rd-card'), l = LEIT.find(x => String(x.id) === card.dataset.id), a = b.dataset.a;
    if (a === 'pg') await atualizarPagina(l, card.querySelector('[data-pg]').value); else if (a === 'fim') await concluir(l); else if (a === 'rm') remover(l); else if (a === 'pub') abrirPublicar(l, l.status === 'lido');
    else if (a === 'ini') { await atualizar(l, { status: 'lendo', iniciado_em: new Date().toISOString() }); aba = 'lendo'; render(); } };
}
window.Leituras = { render, recarregar: () => { carregado = false; render(); }, stats };
document.addEventListener('DOMContentLoaded', () => setTimeout(iniciar, 0));
})();
