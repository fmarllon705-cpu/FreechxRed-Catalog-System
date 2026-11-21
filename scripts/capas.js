// Venous • Recuperação de capas: vários métodos em cascata (ISBN e também título + autor), validação da imagem e busca em lote.
(() => {
const $ = s => document.querySelector(s), esc = v => escaparHTML(v), toast = (...a) => window.hubToast?.(...a);
const METODOS = [['olisbn', 'Open Library (ISBN)'], ['brasil', 'BrasilAPI (ISBN)'], ['gisbn', 'Google Livros (ISBN)'], ['amazon', 'Amazon (ISBN-10)'], ['gtitulo', 'Google Livros (título + autor)'], ['oltitulo', 'Open Library (título + autor)'], ['gsotitulo', 'Google Livros (só o título)'], ['gerada', 'Capa ilustrativa gerada']];
const PADRAO = METODOS.map(m => m[0]).filter(m => m !== 'gerada');
const NOME = Object.fromEntries(METODOS);
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]+/g, ' ').trim();
const PARADAS = new Set('o a os as de da do das dos e em um uma the of and for la el los las le les'.split(' '));
const tokens = s => new Set(norm(s).split(/\s+/).filter(t => t && !PARADAS.has(t)));
const similar = (a, b) => { const A = tokens(a), B = tokens(b); if (!A.size || !B.size) return 0; let n = 0; A.forEach(t => { if (B.has(t)) n++; }); return n / Math.max(A.size, Math.min(B.size, A.size + 1)); };
const sobrenome = a => { a = String(a || '').trim(); if (!a) return ''; return a.includes(',') ? a.split(',')[0].trim() : a.split(/\s+/).pop(); };
// ---------- ISBN ----------
const to13 = i => { const b = '978' + i.slice(0, 9); let s = 0; for (let k = 0; k < 12; k++) s += +b[k] * (k % 2 ? 3 : 1); return b + ((10 - s % 10) % 10); };
const to10 = i => { if (!i.startsWith('978')) return null; const b = i.slice(3, 12); let s = 0; for (let k = 0; k < 9; k++) s += +b[k] * (10 - k); const c = (11 - s % 11) % 11; return b + (c === 10 ? 'X' : c); };
function isbns(l) { const m = /[\dXx][\dXx\- ]{8,16}[\dXx]/.exec(String(l.isbn || '')), d = m ? m[0].replace(/[^0-9Xx]/g, '').toUpperCase() : '', out = []; if (d.length === 13) { out.push(d); const t = to10(d); if (t) out.push(t); } else if (d.length === 10) { out.push(to13(d), d); } return out; }
// ---------- rede ----------
async function json(url, ms = 9000) { const c = new AbortController(), t = setTimeout(() => c.abort(), ms); try { const r = await fetch(url, { signal: c.signal }); return r.ok ? await r.json() : null; } catch (_) { return null; } finally { clearTimeout(t); } }
const imagemOk = url => new Promise(ok => { const i = new Image(), t = setTimeout(() => ok(false), 9000); i.onload = () => { clearTimeout(t); ok(i.naturalWidth >= 70 && i.naturalHeight >= 90); }; i.onerror = () => { clearTimeout(t); ok(false); }; i.referrerPolicy = 'no-referrer'; i.src = url; });
const https = u => String(u || '').replace(/^http:/, 'https:').replace('&edge=curl', '').replace('zoom=1', 'zoom=2');
const gcapa = it => { const im = it?.volumeInfo?.imageLinks || {}; return https(im.thumbnail || im.smallThumbnail || ''); };
const gkey = o => o.googleKey ? `&key=${encodeURIComponent(o.googleKey)}` : '';
async function primeiraValida(urls) { for (const u of urls) if (u && await imagemOk(u)) return u; return null; }
function gerada(l) {                                                                // último recurso: capa ilustrativa (não é a capa real)
  const t = String(l.titulo_principal || 'Sem título'), h = [...t].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7), c1 = `hsl(${h % 360} 45% 35%)`, c2 = `hsl(${(h + 40) % 360} 50% 22%)`, linhas = []; let cur = '';
  t.split(/\s+/).forEach(p => { if ((cur + ' ' + p).trim().length > 16) { linhas.push(cur); cur = p; } else cur = (cur + ' ' + p).trim(); }); if (cur) linhas.push(cur);
  const txt = linhas.slice(0, 5).map((x, i) => `<text x="100" y="${90 + i * 22}" text-anchor="middle" font-size="17" font-weight="700" fill="#fff" font-family="Arial,sans-serif">${esc(x)}</text>`).join(''), aut = esc(String(l.nome_pessoal || '').slice(0, 26));
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="200" height="300" fill="url(#g)"/><rect x="12" y="12" width="176" height="276" fill="none" stroke="#ffffff55" stroke-width="2"/>${txt}<text x="100" y="270" text-anchor="middle" font-size="12" fill="#ffffffcc" font-family="Arial,sans-serif">${aut}</text></svg>`);
}
// ---------- métodos (cada um devolve a URL da capa ou null) ----------
const M = {
  async olisbn(l) { return primeiraValida(isbns(l).map(i => `https://covers.openlibrary.org/b/isbn/${i}-L.jpg?default=false`)); },
  async brasil(l) { for (const i of isbns(l)) { const j = await json(`https://brasilapi.com.br/api/isbn/v1/${i}`); if (j?.cover_url && await imagemOk(https(j.cover_url))) return https(j.cover_url); } return null; },
  async gisbn(l, o) { for (const i of isbns(l)) { const j = await json(`https://www.googleapis.com/books/v1/volumes?q=isbn:${i}&maxResults=3${gkey(o)}`); const u = await primeiraValida((j?.items || []).map(gcapa)); if (u) return u; } return null; },
  async amazon(l) { const i10 = isbns(l).find(i => i.length === 10); return i10 ? primeiraValida([`https://images-na.ssl-images-amazon.com/images/P/${i10}.01.LZZZZZZZ.jpg`]) : null; },
  async gtitulo(l, o) { if (!l.titulo_principal) return null; const a = sobrenome(l.nome_pessoal), j = await json(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent('intitle:' + l.titulo_principal + (a ? ' inauthor:' + a : ''))}&maxResults=6&printType=books${gkey(o)}`);
    const ok = (j?.items || []).filter(it => { const v = it.volumeInfo || {}; return similar(l.titulo_principal, [v.title, v.subtitle].join(' ')) >= 0.7 && (!a || norm((v.authors || []).join(' ')).includes(norm(a))); }); return primeiraValida(ok.map(gcapa)); },
  async oltitulo(l) { if (!l.titulo_principal) return null; const a = sobrenome(l.nome_pessoal), j = await json(`https://openlibrary.org/search.json?title=${encodeURIComponent(l.titulo_principal)}${a ? '&author=' + encodeURIComponent(a) : ''}&limit=6&fields=title,subtitle,author_name,cover_i,isbn`);
    for (const d of (j?.docs || []).filter(d => similar(l.titulo_principal, [d.title, d.subtitle].join(' ')) >= 0.7 && (!a || norm((d.author_name || []).join(' ')).includes(norm(a))))) { const u = await primeiraValida([d.cover_i && `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg?default=false`, ...(d.isbn || []).slice(0, 2).map(i => `https://covers.openlibrary.org/b/isbn/${i}-L.jpg?default=false`)]); if (u) return u; } return null; },
  async gsotitulo(l, o) { if (!l.titulo_principal || tokens(l.titulo_principal).size < 2) return null; const j = await json(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent('intitle:' + l.titulo_principal)}&maxResults=6&printType=books${gkey(o)}`);
    return primeiraValida((j?.items || []).filter(it => similar(l.titulo_principal, it.volumeInfo?.title) >= 0.85).map(gcapa)); },
  async gerada(l) { return gerada(l); }
};
// ---------- API pública ----------
async function buscarCapa(l, o = {}) {
  const lista = (o.metodos || PADRAO), tent = [];
  for (const m of lista) { if (o.parar?.()) break; if (!M[m]) continue; let u = null; try { u = await M[m](l, o); } catch (_) {} tent.push([m, !!u]); if (u) return { url: u, metodo: m, tentativas: tent }; await new Promise(r => setTimeout(r, o.pausa ?? 60)); }
  return { url: null, metodo: null, tentativas: tent };
}
async function salvarCapa(l, url) { l.capa_url = url; const sb = window.supabaseClient; if (sb) { const { error } = await sb.from('acervo').update({ capa_url: url }).eq('id', l.id); if (error) throw new Error(error.message); } }
async function lote(livros, o, cb) {
  let i = 0; const res = { total: livros.length, feitos: 0, achadas: 0, erros: 0, falhas: [], porMetodo: {} };
  const worker = async () => { while (i < livros.length && !o.parar?.()) { const l = livros[i++], r = await buscarCapa(l, o); res.feitos++;
    if (r.url) { try { await salvarCapa(l, r.url); res.achadas++; res.porMetodo[r.metodo] = (res.porMetodo[r.metodo] || 0) + 1; } catch (e) { res.erros++; res.falhas.push(l); } } else res.falhas.push(l); cb?.(res, l, r); } };
  await Promise.all(Array.from({ length: o.concorrencia || 3 }, worker)); return res;
}

// ---------- Painel de busca em lote (Gestão › Dados) ----------
let parar = false, rodando = false;
function painel(root) {
  const ativos = () => (typeof acervoCompleto !== 'undefined' ? acervoCompleto : []).filter(l => !l.em_lixeira), semCapa = () => ativos().filter(l => !l.capa_url), comIsbn = () => semCapa().filter(l => isbns(l).length).length;
  const chave = localStorage.getItem('venous_google_key') || '';
  root.innerHTML = `<div class="box"><h4><i class="fa-solid fa-image"></i> Capas dos livros</h4>
    <p class="muted" style="font-size:.85rem">O backup do Biblivre <b>não traz capas</b> (só fotos de leitores), por isso elas são buscadas na internet. Cada livro passa por vários métodos, na ordem, até achar uma imagem válida — inclusive os que não têm ISBN.</p>
    <div class="kpis" id="cpKpi"></div>
    <div class="lbl" style="margin:6px 0">Métodos de busca (nesta ordem)</div><div class="io-opt">${METODOS.map(([k, n]) => `<label class="chk"><input type="checkbox" data-m="${k}" ${PADRAO.includes(k) ? 'checked' : ''}> ${n}${k === 'gerada' ? ' <small class="muted">— não é a capa real; só como último recurso</small>' : ''}</label>`).join('')}</div>
    <div class="cf-grid"><label class="cf"><span>Quantos livros nesta rodada</span><select id="cpLim"><option value="50">50 (teste)</option><option value="200">200</option><option value="500">500</option><option value="0">Todos sem capa</option></select></label><label class="cf"><span>Chave da API do Google Livros (opcional)</span><input id="cpKey" value="${esc(chave)}" placeholder="aumenta o limite de consultas"></label></div>
    <div class="btn-group" style="margin-top:12px"><button class="btn btn-primary" id="cpGo"><i class="fa-solid fa-magnifying-glass"></i> Buscar capas</button><button class="btn btn-outline" id="cpStop" disabled>Parar</button><button class="btn btn-outline hidden" id="cpCsv"><i class="fa-solid fa-file-csv"></i> Baixar lista dos não encontrados</button></div>
    <div id="cpProg" class="hidden"><div class="io-prog"><i id="cpBar"></i></div><div id="cpTxt" class="muted" style="font-size:.82rem"></div><div id="cpMet" class="chips" style="margin-top:6px"></div><div id="cpThumbs" class="cp-thumbs"></div></div></div>`;
  const kpi = () => { const t = ativos().length, s = semCapa().length; $('#cpKpi').innerHTML = `<div class="kpi"><b>${s}</b><span>Títulos sem capa (de ${t})</span></div><div class="kpi"><b>${comIsbn()}</b><span>sem capa e com ISBN</span></div><div class="kpi"><b>${s - comIsbn()}</b><span>sem capa e sem ISBN (busca por título/autor)</span></div>`; }; kpi();
  let falhas = [];
  $('#cpStop').onclick = () => { parar = true; $('#cpStop').disabled = true; };
  $('#cpCsv').onclick = () => { const IO = window.VenousIO, linhas = [['tombo', 'titulo', 'autor', 'isbn'], ...falhas.map(l => [l.numero_tombo, l.titulo_principal, l.nome_pessoal, l.isbn])], a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([IO.csvTexto(linhas)], { type: 'text/csv' })), download: 'capas-nao-encontradas.csv' }); a.click(); };
  $('#cpGo').onclick = async () => {
    if (rodando) return; const metodos = [...root.querySelectorAll('[data-m]:checked')].map(x => x.dataset.m), lim = +$('#cpLim').value, key = $('#cpKey').value.trim(); if (!metodos.length) return toast('Marque ao menos um método.', 'erro');
    localStorage.setItem('venous_google_key', key); let fila = semCapa(); if (lim) fila = fila.slice(0, lim); if (!fila.length) return toast('Nenhum título sem capa.');
    rodando = true; parar = false; $('#cpGo').disabled = true; $('#cpStop').disabled = false; $('#cpProg').classList.remove('hidden'); $('#cpCsv').classList.add('hidden'); $('#cpThumbs').innerHTML = '';
    const res = await lote(fila, { metodos, googleKey: key, parar: () => parar, concorrencia: 3 }, (r, l, x) => {
      $('#cpBar').style.width = Math.round(r.feitos / r.total * 100) + '%'; $('#cpTxt').textContent = `${r.feitos} de ${r.total} • ${r.achadas} capas encontradas • ${r.falhas.length} sem resultado`;
      $('#cpMet').innerHTML = Object.entries(r.porMetodo).map(([k, v]) => `<span class="chip on">${NOME[k]}: ${v}</span>`).join('');
      if (x.url && !x.url.startsWith('data:')) { const t = $('#cpThumbs'); t.insertAdjacentHTML('afterbegin', `<img src="${esc(x.url)}" title="${esc(l.titulo_principal)}" alt="">`); while (t.children.length > 10) t.lastChild.remove(); } });
    falhas = res.falhas; rodando = false; $('#cpGo').disabled = false; $('#cpStop').disabled = true; kpi(); if (falhas.length) $('#cpCsv').classList.remove('hidden');
    toast(parar ? 'Busca interrompida.' : `Concluído: ${res.achadas} capas encontradas.`); window.filtrarAcervoAgora?.();
  };
}

// ---------- Botão "Buscar capa" no formulário de catalogação ----------
function botaoCatalogacao() {
  const arq = $('#capa_file'); if (!arq || $('#btnBuscarCapa')) return;
  const b = Object.assign(document.createElement('button'), { type: 'button', id: 'btnBuscarCapa', className: 'btn btn-outline btn-sm', innerHTML: '<i class="fa-solid fa-magnifying-glass"></i> Buscar capa na internet' }); b.style.marginLeft = '8px'; arq.after(b);
  b.onclick = async () => {
    const l = { isbn: $('#isbn')?.value, titulo_principal: $('#titulo_principal')?.value, nome_pessoal: $('#nome_pessoal')?.value }; if (!l.isbn && !l.titulo_principal) return toast('Informe o ISBN ou o título primeiro.', 'erro');
    b.disabled = true; b.textContent = 'Buscando…'; const r = await buscarCapa(l, { googleKey: localStorage.getItem('venous_google_key') || '' }); b.disabled = false; b.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Buscar capa na internet';
    if (!r.url) return toast('Nenhuma capa encontrada. Envie uma foto da capa.', 'erro');
    $('#capa_url').value = r.url; $('#imgPreviewCapa').src = r.url; $('#previewCapaContainer').style.display = 'flex'; toast('Capa encontrada via ' + NOME[r.metodo] + '.');
  };
}
document.addEventListener('DOMContentLoaded', botaoCatalogacao);
window.VenousCapas = { buscarCapa, lote, painel, isbns, similar, METODOS, PADRAO };
})();
