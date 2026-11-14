// Venous • Etiquetas: busca no acervo, posição configurável na folha A4, pré-visualização (SVG) e PDF (jsPDF) com código de barras Code 39.
(() => {
/* =====================================================================================
   ONDE MUDAR A POSIÇÃO DAS INFORMAÇÕES NA FOLHA A4
   1) PELA TELA: aba Catalogação > Etiquetas > "Posição e tamanho na folha A4" (salva no navegador).
   2) PELO CÓDIGO: valores padrão logo abaixo (PADRAO), em milímetros.
      folha.topo / folha.esq ..... margem superior / esquerda da folha
      folha.larg / folha.alt ..... tamanho de cada etiqueta (padrão atual: 50 x 20 = metade do tamanho anterior, 100 x 40)
      escala ..................... encolhe/aumenta TODO o conteúdo (letras, código de barras, espaços). 100 = projeto original 100 x 40
      folha.colunas / linhas ..... quantas etiquetas por folha (colunas x linhas)
      folha.espH / espV .......... espaço entre etiquetas
      ajuste.<bloco> = [dx, dy] .. empurra o bloco: dx > 0 vai para a direita, dy > 0 vai para baixo
                                   blocos: titulo, barras, tombo, autor, catalog, direita
   3) A posição BASE de cada texto dentro da etiqueta está na função montarEtiqueta() abaixo.
   ===================================================================================== */
const PADRAO = { versao: 2, folha: { topo: 8, esq: 5, larg: 50, alt: 20, colunas: 4, linhas: 14, espH: 0, espV: 0, guias: 1, separador: 0 }, escala: 50, dirLarg: 32, barrasAlt: 9, fonte: 100, secao: 'BIG',
  ajuste: { titulo: [0, 0], barras: [0, 0], tombo: [0, 0], autor: [0, 0], catalog: [0, 0], direita: [0, 0] } };

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)], esc = v => escaparHTML(v), toast = (...a) => window.hubToast(...a);
const tit = l => l.titulo_principal || l.tituloPrincipal || 'Sem título', aut = l => l.nome_pessoal || l.autor_entidade || '', ativos = () => (acervoCompleto || []).filter(l => !l.em_lixeira);
const clone = o => JSON.parse(JSON.stringify(o)), MM = 0.3528;
const mesclar = (a, b) => { for (const k in b) a[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) ? mesclar(a[k] || {}, b[k]) : b[k]; return a; };
let cfg; try { const sv = JSON.parse(localStorage.getItem('venous_etq_cfg')) || {}; cfg = mesclar(clone(PADRAO), sv.versao === PADRAO.versao ? sv : {}); } catch (_) { cfg = clone(PADRAO); }
const salvarCfg = () => { try { localStorage.setItem('venous_etq_cfg', JSON.stringify(cfg)); } catch (_) {} };
let IMP = new Set(); try { IMP = new Set(JSON.parse(localStorage.getItem('venous_etq_impressas')) || []); } catch (_) {}
const impressa = l => l.etiqueta_impressa === true || IMP.has(Number(l.id));
const PRESETS = { grande: { escala: 100, folha: { larg: 100, alt: 40, colunas: 2, linhas: 7 } }, metade: { escala: 50, folha: { larg: 50, alt: 20, colunas: 4, linhas: 14 } } };
let resultados = [], mostrar = 30, sel = new Map(), pag = 0, doc0;

// ---------- Code 39 (n = estreito, w = largo; 9 elementos: barra/espaço alternados) ----------
const C39 = { 0: 'nnnwwnwnn', 1: 'wnnwnnnnw', 2: 'nnwwnnnnw', 3: 'wnwwnnnnn', 4: 'nnnwwnnnw', 5: 'wnnwwnnnn', 6: 'nnwwwnnnn', 7: 'nnnwnnwnw', 8: 'wnnwnnwnn', 9: 'nnwwnnwnn', A: 'wnnnnwnnw', B: 'nnwnnwnnw', C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn', F: 'nnwnwwnnn', G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn', J: 'nnnnwwwnn', K: 'wnnnnnnww', L: 'nnwnnnnww', M: 'wnwnnnnwn', N: 'nnnnwnnww', O: 'wnnnwnnwn', P: 'nnwnwnnwn', Q: 'nnnnnnwww', R: 'wnnnnnwwn', S: 'nnwnnnwwn', T: 'nnnnwnwwn', U: 'wwnnnnnnw', V: 'nwwnnnnnw', W: 'wwwnnnnnn', X: 'nwnnwnnnw', Y: 'wwnnwnnnn', Z: 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '*': 'nwnnwnwnn', $: 'nwnwnwnnn', '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn' };
function barrasRects(code, x, y, w, h) {
  const txt = '*' + String(code).toUpperCase().replace(/[^0-9A-Z\-. $/+%]/g, '') + '*', mod = txt.length * 16 - 1, m = w / mod, r = []; let cx = x;
  [...txt].forEach((ch, i) => { [...C39[ch]].forEach((e, j) => { const lw = (e === 'w' ? 3 : 1) * m; if (j % 2 === 0) r.push([cx, y, lw, h]); cx += lw; }); if (i < txt.length - 1) cx += m; });
  return r;
}

// ---------- Texto ----------
const san = s => String(s ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
function med() { if (!doc0) { const { jsPDF } = window.jspdf || window.web_jspdf; doc0 = new jsPDF({ unit: 'mm', format: 'a4' }); } return (s, pt, b) => { doc0.setFont('helvetica', b ? 'bold' : 'normal'); doc0.setFontSize(pt); return doc0.getTextWidth(s); }; }
function quebrar(txt, larg, pt, b, max, m) {
  const pal = san(txt).split(/\s+/).filter(Boolean), out = []; let l = '';
  for (const p of pal) { const t = l ? l + ' ' + p : p; if (m(t, pt, b) <= larg || !l) l = t; else { out.push(l); l = p; } }
  if (l) out.push(l); if (out.length > max) { out.length = max; let u = out[max - 1]; while (u.length > 1 && m(u + '...', pt, b) > larg) u = u.slice(0, -1); out[max - 1] = u + '...'; }
  return out;
}
const encaixar = (s, larg, pt, b, m) => { s = san(s); if (m(s, pt, b) <= larg) return s; while (s.length > 1 && m(s + '..', pt, b) > larg) s = s.slice(0, -1); return s + '..'; };

// ---------- Monta uma etiqueta (coordenadas em mm, origem no canto superior esquerdo da etiqueta) ----------
function montarEtiqueta(l, c, m) {
  const k = (c.escala || 100) / 100, W = c.folha.larg, H = c.folha.alt, p = 3 * k, f = (c.fonte / 100) * k, dw = c.dirLarg * k, lw = W - dw - 2 * p, P = [], A = x => c.ajuste[x];
  const fs = pt => Math.max(3.5, pt * f);                                                   // tamanho de fonte nunca abaixo de 3,5 pt
  const T = (n, x, y, s, pt, b, al, cs) => P.push({ k: 't', x: x + A(n)[0], y: y + A(n)[1], s, pt: fs(pt), b, al: al || 'l', cs: (cs || 0) * k });
  const tombo = String(l.numero_tombo || '').trim() || '0000000000', sobrenome = (aut(l).split(',')[0] || 'AUTOR').trim().toUpperCase();
  const lin = quebrar(tit(l).toUpperCase(), lw - 3 * k, fs(8.5), true, 2, m); lin.forEach((s, i) => T('titulo', p, p + 3 * k + i * 3.6 * f, s, 8.5, 1));
  const by = p + 3 * k + (lin.length - 1) * 3.6 * f + 1.5 * k, bw = lw - 2 * k, bh = c.barrasAlt * k;   // << posição base do código de barras
  P.push({ k: 'bars', code: tombo, x: p + k + A('barras')[0], y: by + A('barras')[1], w: bw, h: bh });
  T('tombo', p + lw / 2, by + bh + 3.4 * k, tombo, 8, 1, 'c', 0.5);                            // << número do tombo
  T('autor', p, H - p - 3 * k, encaixar('Autor: ' + (l.responsabilidade || aut(l)), lw, fs(6.5), 0, m), 6.5, 0);   // << rodapé: autor
  T('catalog', p, H - p, encaixar('catalogador por: ' + (l.catalogador || ''), lw, fs(6.5), 0, m), 6.5, 0);       // << rodapé: catalogador
  const rx = W - dw + 2 * k, rw = dw - p - 2 * k, y0 = p + 3.5 * k;                           // << coluna direita (lombada)
  [[sobrenome, 9.5], [l.classificacao_cdd || '', 9], [l.codigo_autor_cutter || '', 9], [l.edicao || '', 9]].forEach(([s, pt], i) => { if (s) T('direita', rx, y0 + i * 4.6 * f, encaixar(s, rw, fs(pt), 1, m), pt, 1); });
  T('direita', rx, H - p, encaixar(`${l.exemplares || 1}   ${l.secao_local || l.localizacao || c.secao || ''}`.trim(), rw, fs(8.5), 1, m), 8.5, 1);
  if (c.folha.separador) P.push({ k: 'ln', x1: W - dw - k, y1: p, x2: W - dw - k, y2: H - p });
  return P;
}
function paginar() {
  const c = cfg.folha, m = med(), por = c.colunas * c.linhas, itens = []; sel.forEach((q, id) => { const l = ativos().find(x => +x.id === +id); if (l) for (let i = 0; i < q; i++) itens.push(l); });
  const ini = Math.max(1, Math.min(por, +$('#etqInicio').value || 1)) - 1, pgs = [];
  itens.forEach((l, i) => { const s = ini + i, pg = Math.floor(s / por), pos = s % por; (pgs[pg] ||= []).push({ x: c.esq + (pos % c.colunas) * (c.larg + c.espH), y: c.topo + Math.floor(pos / c.colunas) * (c.alt + c.espV), prims: montarEtiqueta(l, cfg, m) }); });
  return { pgs, ini, por, total: itens.length };
}

// ---------- Pré-visualização (SVG) e PDF ----------
function svg(pg, ini) {
  const c = cfg.folha; let s = `<svg viewBox="0 0 210 297" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;background:#fff;box-shadow:0 4px 14px #0003"><rect width="210" height="297" fill="#fff"/>`;
  for (let i = 0; i < ini; i++) s += `<rect x="${c.esq + (i % c.colunas) * (c.larg + c.espH)}" y="${c.topo + Math.floor(i / c.colunas) * (c.alt + c.espV)}" width="${c.larg}" height="${c.alt}" fill="#e2e8f0"/>`;
  (pg || []).forEach(e => { if (c.guias) s += `<rect x="${e.x}" y="${e.y}" width="${c.larg}" height="${c.alt}" fill="none" stroke="#94a3b8" stroke-width=".2" stroke-dasharray="1 1"/>`;
    e.prims.forEach(p => { if (p.k === 't') s += `<text x="${e.x + p.x}" y="${e.y + p.y}" font-size="${p.pt * MM}" font-family="Helvetica,Arial,sans-serif" font-weight="${p.b ? 700 : 400}" text-anchor="${p.al === 'c' ? 'middle' : 'start'}" letter-spacing="${p.cs}" fill="#000">${esc(p.s)}</text>`;
      else if (p.k === 'bars') barrasRects(p.code, e.x + p.x, e.y + p.y, p.w, p.h).forEach(r => s += `<rect x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}"/>`);
      else if (p.k === 'ln') s += `<line x1="${e.x + p.x1}" y1="${e.y + p.y1}" x2="${e.x + p.x2}" y2="${e.y + p.y2}" stroke="#666" stroke-width=".2" stroke-dasharray="1 1"/>`; }); });
  return s + '</svg>';
}
function renderPrev() {
  const { pgs, ini, por, total } = paginar(), n = Math.max(1, pgs.length); pag = Math.min(pag, n - 1);
  $('#etqPrev').innerHTML = svg(pgs[pag] || [], pag === 0 ? ini : 0);
  $('#etqPagTxt').textContent = `Página ${pag + 1} de ${n}`; $('#etqPrevV').disabled = pag <= 0; $('#etqPrevN').disabled = pag >= n - 1;
  $('#etqResumo').innerHTML = `<b>${sel.size}</b> livro(s) • <b>${total}</b> etiqueta(s) • <b>${pgs.length || 0}</b> folha(s)`; $('#etqBarN').textContent = total; $('#etqBar').classList.toggle('on', total > 0);
  ['etqGerar', 'etqImprimir', 'etqBarGerar'].forEach(i => $('#' + i).disabled = !total);
}
function gerarPDF(abrir) {
  if (!(window.jspdf || window.web_jspdf)) return toast('Biblioteca de PDF ainda carregando. Tente novamente em instantes.', 'erro');
  const { pgs } = paginar(); if (!pgs.length) return; const { jsPDF } = window.jspdf || window.web_jspdf, d = new jsPDF({ unit: 'mm', format: 'a4' }), c = cfg.folha;
  pgs.forEach((pg, i) => { if (i) d.addPage(); (pg || []).forEach(e => {
    if (c.guias) { d.setDrawColor(150); d.setLineWidth(0.15); d.setLineDashPattern([1, 1], 0); d.rect(e.x, e.y, c.larg, c.alt); d.setLineDashPattern([], 0); }
    e.prims.forEach(p => { d.setTextColor(0); d.setFillColor(0);
      if (p.k === 't') { d.setFont('helvetica', p.b ? 'bold' : 'normal'); d.setFontSize(p.pt); d.text(p.s, e.x + p.x, e.y + p.y, { align: p.al === 'c' ? 'center' : 'left', charSpace: p.cs }); }
      else if (p.k === 'bars') barrasRects(p.code, e.x + p.x, e.y + p.y, p.w, p.h).forEach(r => d.rect(r[0], r[1], r[2], r[3], 'F'));
      else if (p.k === 'ln') { d.setDrawColor(100); d.setLineWidth(0.15); d.setLineDashPattern([1, 1], 0); d.line(e.x + p.x1, e.y + p.y1, e.x + p.x2, e.y + p.y2); d.setLineDashPattern([], 0); } }); }); });
  if (abrir) window.open(d.output('bloburl'), '_blank'); else d.save('etiquetas-venous.pdf');
  marcarImpressas(); toast(`PDF gerado com ${pgs.flat().length} etiqueta(s).`);
}
async function marcarImpressas() {
  const ids = [...sel.keys()].map(Number); ids.forEach(i => IMP.add(i)); try { localStorage.setItem('venous_etq_impressas', JSON.stringify([...IMP])); } catch (_) {}
  try { if (typeof supabaseClient !== 'undefined' && supabaseClient) await supabaseClient.from('acervo').update({ etiqueta_impressa: true }).in('id', ids); } catch (_) {}
  renderLista();
}

// ---------- Busca e seleção ----------
function listar(recentes) {
  const q = $('#etqQ').value.trim().toLowerCase(), campo = $('#etqCampo').value, mat = $('#etqMat').value, so = $('#etqNovas').checked;
  let r = ativos().filter(l => (!mat || (l.tipo_material || 'Livros') === mat) && (!so || !impressa(l)) && (!q || (campo === 'title' ? tit(l) : campo === 'author' ? aut(l) : campo === 'tombo' ? l.numero_tombo || '' : `${tit(l)} ${aut(l)} ${l.numero_tombo || ''}`).toLowerCase().includes(q)));
  if (recentes) { const dt = l => l.created_at ? new Date(l.created_at) : null, lim = Date.now() - 7 * 864e5; r = r.some(dt) ? r.filter(l => dt(l) && dt(l) >= lim) : [...r].sort((a, b) => b.id - a.id).slice(0, 20); if (!r.length) toast('Nenhum livro catalogado recentemente.'); }
  resultados = r; mostrar = 30; renderLista();
}
function renderLista() {
  $('#etqCount').textContent = resultados.length; const v = resultados.slice(0, mostrar);
  $('#etqLista').innerHTML = v.length ? v.map(l => { const on = sel.has(+l.id); return `<div class="etq-item${on ? ' on' : ''}" data-id="${l.id}"><div class="i"><div><span class="muted">Tombo</span> <b>${esc(l.numero_tombo || '—')}</b> ${impressa(l) ? '<span class="st Concluida">Etiqueta impressa</span>' : ''}</div><div><b>${esc(tit(l))}</b></div><small class="muted">${esc(aut(l))} • ${esc(l.classificacao_cdd || '')} ${esc(l.codigo_autor_cutter || '')}</small></div><button class="btn ${on ? 'btn-danger' : 'btn-outline'} btn-sm" data-t="${l.id}">${on ? 'Remover' : 'Selecionar'}</button></div>`; }).join('') : '<p class="muted" style="padding:10px 0">Nenhum livro encontrado com esses filtros.</p>';
  $('#etqMais').classList.toggle('hidden', resultados.length <= mostrar);
}
function renderSel() {
  $('#etqSel').innerHTML = [...sel].map(([id, q]) => { const l = ativos().find(x => +x.id === +id); return l ? `<div class="etq-sel"><span class="i">${esc(tit(l))}</span><span class="qtd"><button data-q="-1" data-id="${id}" aria-label="Menos">−</button><b>${q}</b><button data-q="1" data-id="${id}" aria-label="Mais">+</button></span><button data-rm="${id}" aria-label="Remover"><i class="fa-solid fa-xmark"></i></button></div>` : ''; }).join('') || '<p class="muted" style="font-size:.85rem">Nenhum livro selecionado. Pesquise e toque em “Selecionar”.</p>';
  renderPrev();
}

// ---------- Configuração na tela ----------
const CAMPOS = [['folha.topo', 'Margem superior'], ['folha.esq', 'Margem esquerda'], ['folha.larg', 'Largura da etiqueta'], ['folha.alt', 'Altura da etiqueta'], ['folha.colunas', 'Colunas'], ['folha.linhas', 'Linhas'], ['folha.espH', 'Espaço horizontal'], ['folha.espV', 'Espaço vertical'], ['escala', 'Escala do conteúdo (%)'], ['dirLarg', 'Largura coluna direita'], ['barrasAlt', 'Altura código de barras'], ['fonte', 'Tamanho do texto (%)']];
const BLOCOS = [['titulo', 'Título'], ['barras', 'Código de barras'], ['tombo', 'Nº do tombo'], ['autor', 'Autor'], ['catalog', 'Catalogador'], ['direita', 'Coluna direita']];
const get = p => p.split('.').reduce((o, k) => o[k], cfg), set = (p, v) => { const k = p.split('.'), u = k.pop(); k.reduce((o, x) => o[x], cfg)[u] = v; };
function montarCfg() {
  $('#etqCfgFolha').innerHTML = CAMPOS.map(([p, n]) => `<label class="cf"><span>${n}</span><input type="number" step="0.5" data-p="${p}" value="${get(p)}"></label>`).join('') + `<label class="cf"><span>Texto da seção (ex.: BIG)</span><input type="text" maxlength="12" data-p="secao" value="${esc(cfg.secao)}"></label><label class="chk"><input type="checkbox" data-p="folha.guias" ${cfg.folha.guias ? 'checked' : ''}> Linhas-guia de corte</label><label class="chk"><input type="checkbox" data-p="folha.separador" ${cfg.folha.separador ? 'checked' : ''}> Linha separando a coluna direita</label>`;
  $('#etqCfgAjuste').innerHTML = BLOCOS.map(([b, n]) => `<div class="aj"><span>${n}</span><label>→ <input type="number" step="0.5" data-p="ajuste.${b}.0" value="${cfg.ajuste[b][0]}"></label><label>↓ <input type="number" step="0.5" data-p="ajuste.${b}.1" value="${cfg.ajuste[b][1]}"></label></div>`).join('');
}
function iniciar() {
  if (!$('#etqQ') || iniciar.ok) return; iniciar.ok = true; montarCfg();
  const mats = [...new Set(ativos().map(l => l.tipo_material || 'Livros'))]; $('#etqMat').innerHTML += mats.map(m => `<option>${esc(m)}</option>`).join('');
  $('#etqListar').onclick = () => listar(); $('#etqRecentes').onclick = () => listar(true); $('#etqQ').onkeydown = e => { if (e.key === 'Enter') listar(); };
  $('#etqLimparBusca').onclick = () => { $('#etqQ').value = ''; $('#etqNovas').checked = false; $('#etqMat').value = ''; listar(); };
  $('#etqMais').onclick = () => { mostrar += 30; renderLista(); }; $('#etqSelPag').onclick = () => { resultados.slice(0, mostrar).forEach(l => sel.set(+l.id, sel.get(+l.id) || 1)); renderLista(); renderSel(); };
  $('#etqLista').onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; const id = +b.dataset.t; sel.has(id) ? sel.delete(id) : sel.set(id, 1); renderLista(); renderSel(); };
  $('#etqSel').onclick = e => { const b = e.target.closest('button'); if (!b) return; const id = +(b.dataset.id || b.dataset.rm); if (b.dataset.rm) sel.delete(id); else sel.set(id, Math.max(1, Math.min(50, sel.get(id) + +b.dataset.q))); renderLista(); renderSel(); };
  $('#etqLimparSel').onclick = () => { sel.clear(); renderLista(); renderSel(); };
  $('#etqCfg').oninput = e => { const p = e.target.dataset.p; if (!p) return; set(p, e.target.type === 'checkbox' ? +e.target.checked : e.target.type === 'number' ? +e.target.value || 0 : e.target.value); salvarCfg(); renderPrev(); };
  $('#etqInicio').oninput = renderPrev; $('#etqPrevV').onclick = () => { pag--; renderPrev(); }; $('#etqPrevN').onclick = () => { pag++; renderPrev(); };
  $$('[data-preset]').forEach(b => b.onclick = () => { mesclar(cfg, clone(PRESETS[b.dataset.preset])); salvarCfg(); montarCfg(); renderPrev(); toast('Tamanho aplicado: ' + cfg.folha.larg + ' x ' + cfg.folha.alt + ' mm.'); });
  $('#etqPadrao').onclick = () => { cfg = clone(PADRAO); salvarCfg(); montarCfg(); renderPrev(); toast('Posições restauradas ao padrão.'); };
  $('#etqGerar').onclick = () => gerarPDF(false); $('#etqBarGerar').onclick = () => gerarPDF(false); $('#etqImprimir').onclick = () => gerarPDF(true);
  if (matchMedia('(max-width:768px), (hover:none) and (pointer:coarse) and (max-width:1100px)').matches) $('#etqCfg').open = false;
  listar(); renderSel();
}
window.initEtiquetas = () => Promise.resolve(window.appReady).then(iniciar);
})();
