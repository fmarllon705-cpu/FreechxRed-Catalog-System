// Venous • Busca avançada do acervo: critério + filtros combináveis (disponibilidade, tipo de material, idioma). Consulta o Supabase com .ilike() na coluna escolhida.
(() => {
const $ = s => document.querySelector(s), esc = v => escaparHTML(v);
const CRITERIOS = { all: 'Todos os campos', titulo: 'Título', autor: 'Autor', assunto: 'Assunto / Palavras-chave', isbn: 'ISBN', editora: 'Editora', cdd: 'Código de chamada / CDD-CDU', ano: 'Ano de publicação' };
// critério → colunas reais da tabela acervo
const COLUNAS = { titulo: ['titulo_principal'], autor: ['nome_pessoal', 'autor_entidade'], assunto: ['assunto'], isbn: ['isbn'], editora: ['editora'], cdd: ['classificacao_cdd', 'codigo_autor_cutter'], ano: ['data_publicacao'],
  all: ['titulo_principal', 'nome_pessoal', 'autor_entidade', 'assunto', 'isbn', 'editora', 'classificacao_cdd', 'numero_tombo', 'data_publicacao'] };
const IDIOMAS = { po: 'Português', pt: 'Português', en: 'Inglês', es: 'Espanhol', fr: 'Francês', it: 'Italiano', de: 'Alemão', la: 'Latim', ja: 'Japonês' };
let disp = 'todas', seq = 0, amostraIds = null, amostraBase = -1, limite = 50, chaveAnt = '';
const fmtN = n => Number(n).toLocaleString('pt-BR'), semCapa = l => !String(l.capa_url || l.capaUrl || '').trim();
const embaralhar = a => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
function sortear(todos) { amostraIds = [...embaralhar(todos.filter(l => !semCapa(l))), ...embaralhar(todos.filter(semCapa))].slice(0, 50).map(l => l.id); amostraBase = todos.length; }   // 50 aleatórias, com capa primeiro
function amostra(todos) { if (!amostraIds || amostraBase !== todos.length) sortear(todos); const m = new Map(todos.map(l => [l.id, l])); return amostraIds.map(i => m.get(i)).filter(Boolean); }
function renderizarCapas(lista) {
  const box = $('#visaoCapasAcervo'); if (!box) return; if (!lista.length) { box.innerHTML = '<div class="acervo-vazio">Nenhuma obra encontrada.</div>'; return; }
  const fav = id => (typeof listaFavoritos !== 'undefined' ? listaFavoritos : []).some(f => f.livro_id == id && f.usuario_id == usuarioAtual.id);
  box.innerHTML = `<div class="row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-lg-5 row-cols-xl-6 g-2 g-md-3">${lista.map(l => { const capa = String(l.capa_url || l.capaUrl || '').trim(), t = l.titulo_principal || 'Sem título', ok = disponivel(l);
    return `<div class="col"><article class="capa-card"><div class="capa-link" role="button" tabindex="0" data-cip="${l.id}" aria-label="Abrir a CIP de ${esc(t)}" title="Ver a CIP">${capa ? `<img class="capa-img" loading="lazy" src="${esc(capa)}" alt="Capa de ${esc(t)}">` : '<div class="capa-img ph"><i class="fa-solid fa-book"></i></div>'}<span class="capa-dica"><i class="fa-solid fa-id-card"></i> Ver CIP</span></div><div class="capa-info"><b class="capa-tit" title="${esc(t)}">${esc(t)}</b><small class="capa-aut">${esc(l.nome_pessoal || l.autor_entidade || 'Autor não informado')}</small><span class="capa-st ${ok ? 'ok' : 'no'}">${ok ? 'Disponível' : 'Emprestado'}</span></div><div class="capa-acoes"><button class="btn btn-primary btn-sm" onclick="solicitarReserva(${l.id})"><i class="fa-solid fa-bookmark"></i> Reservar</button><button class="btn btn-outline btn-sm" aria-label="Favoritar" onclick="alternarFavorito(${l.id})"><i class="${fav(l.id) ? 'fa-solid' : 'fa-regular'} fa-heart"></i></button><button class="btn btn-outline btn-sm" aria-label="CIP e resenhas" title="CIP / Resenhas" onclick="verCIP(${l.id})"><i class="fa-solid fa-id-card"></i></button></div></article></div>`; }).join('')}</div>`;
}
function rodape(home, total, n, totalAcervo) {
  const r = $('#acervoRodape'); if (!r) return;
  r.innerHTML = home ? (totalAcervo > n ? `<p class="muted">Você viu ${n} de ${fmtN(totalAcervo)} obras. Use a busca para encontrar as demais.</p><button class="btn btn-primary" id="btnOutras"><i class="fa-solid fa-shuffle"></i> Mostrar outras ${Math.min(50, totalAcervo)} obras</button>` : '')
    : (total > n ? `<p class="muted">Mostrando ${n} de ${fmtN(total)} resultados.</p><button class="btn btn-outline" id="btnMais"><i class="fa-solid fa-angles-down"></i> Mostrar mais ${Math.min(50, total - n)}</button>` : '');
}
const norm = t => String(t ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const limpar = t => t.replace(/[,()"\\*]/g, ' ').replace(/[%_]/g, m => '\\' + m).trim();

function disponivel(l) { const tot = Number(l.exemplares) || 1, em = (typeof listaEmprestimos !== 'undefined' ? listaEmprestimos : []).filter(e => +e.livro_id === +l.id).length; return tot - em > 0; }
async function consultar(q, crit, tipo, idioma) {                                    // devolve ids vindos do servidor (ou null para usar o filtro local)
  if (!window.supabaseClient || !q) return null;
  let qb = window.supabaseClient.from('acervo').select('*'), cols = COLUNAS[crit] || COLUNAS.all;
  qb = cols.length === 1 ? qb.ilike(cols[0], `%${q}%`) : qb.or(cols.map(c => `${c}.ilike.%${limpar(q)}%`).join(','));   // ex.: Título + "O Exorcista" => titulo_principal ILIKE '%O Exorcista%'
  if (tipo) qb = qb.eq('tipo_material', tipo); if (idioma) qb = qb.eq('codigo_idioma', idioma);
  const { data, error } = await qb.limit(500); return error ? null : data;
}
function localmente(q, crit, l) {
  if (!q) return true; const n = norm(q); return (COLUNAS[crit] || COLUNAS.all).some(c => norm(l[c]).includes(n));
}
window.filtrarAcervoAgora = async function () {
  const meu = ++seq, q = ($('#txtBusca')?.value || '').trim(), crit = $('#buscaCriterio')?.value || 'all', tipo = $('#filtroTipo')?.value || '', idioma = $('#filtroIdioma')?.value || '';
  const todos = (typeof acervoCompleto !== 'undefined' ? acervoCompleto : []).filter(l => !l.em_lixeira); let lista;
  const srv = await consultar(q, crit, tipo, idioma); if (meu !== seq) return;      // ignora respostas antigas
  if (srv) { const ids = new Set(srv.map(d => +d.id)); lista = todos.filter(l => ids.has(+l.id)); srv.forEach(d => { if (!d.em_lixeira && !todos.some(l => +l.id === +d.id)) lista.push(d); }); }
  else lista = todos.filter(l => localmente(q, crit, l) && (!tipo || (l.tipo_material || 'Livros') === tipo) && (!idioma || (l.codigo_idioma || 'po') === idioma));
  if (disp !== 'todas') lista = lista.filter(l => disponivel(l) === (disp === 'disponivel'));
  const f = [q && `${CRITERIOS[crit]}: “${q}”`, disp !== 'todas' && (disp === 'disponivel' ? 'Disponíveis' : 'Emprestados'), tipo, idioma && (IDIOMAS[idioma] || idioma)].filter(Boolean), home = !f.length;
  const chave = [q, crit, tipo, idioma, disp].join('|'); if (chave !== chaveAnt) { limite = 50; chaveAnt = chave; }
  const total = lista.length, mostrados = home ? amostra(todos) : lista.slice(0, limite);     // início: 50 aleatórias; busca/filtro: todos os resultados (50 por vez)
  renderizarTabelaAcervo(mostrados); renderizarCarrosseis(mostrados); renderizarCapas(mostrados); rodape(home, total, mostrados.length, todos.length);
  if ($('#buscaInfo')) $('#buscaInfo').innerHTML = home ? `<span><b>${mostrados.length}</b> obras aleatórias de ${fmtN(todos.length)} no acervo — use a busca para encontrar as demais.</span> ${todos.length > mostrados.length ? '<button type="button" class="btn btn-outline btn-sm" id="btnOutrasTopo"><i class="fa-solid fa-shuffle"></i> Outras 50</button>' : ''}` : `<b>${fmtN(total)}</b> obra(s) encontrada(s) • ${f.map(esc).join(' • ')}`;
  if ($('#btnLimparBusca')) $('#btnLimparBusca').classList.toggle('hidden', !f.length);
};
function opcoes() {
  const a = (typeof acervoCompleto !== 'undefined' ? acervoCompleto : []).filter(l => !l.em_lixeira), tipos = [...new Set(a.map(l => l.tipo_material || 'Livros'))].sort(), langs = [...new Set(a.map(l => l.codigo_idioma || 'po'))].sort();
  const t = $('#filtroTipo'), i = $('#filtroIdioma'), tv = t.value, iv = i.value;
  t.innerHTML = '<option value="">Tipo de material: todos</option>' + tipos.map(x => `<option>${esc(x)}</option>`).join(''); i.innerHTML = '<option value="">Idioma: todos</option>' + langs.map(x => `<option value="${esc(x)}">${esc(IDIOMAS[x] || x)}</option>`).join(''); t.value = tv; i.value = iv;
}
function iniciar() {
  if (!$('#buscaCriterio')) return; $('#buscaCriterio').innerHTML = Object.entries(CRITERIOS).map(([k, n]) => `<option value="${k}">${n}</option>`).join('');
  const f = () => filtrarAcervo(); $('#buscaCriterio').onchange = f; $('#filtroTipo').onchange = f; $('#filtroIdioma').onchange = f;
  $('#buscaDisp').onclick = e => { const b = e.target.closest('[data-d]'); if (!b) return; disp = b.dataset.d; document.querySelectorAll('#buscaDisp .chip').forEach(c => c.classList.toggle('on', c === b)); filtrarAcervoAgora(); };
  $('#btnLimparBusca').onclick = () => { $('#txtBusca').value = ''; $('#buscaCriterio').value = 'all'; $('#filtroTipo').value = ''; $('#filtroIdioma').value = ''; disp = 'todas'; document.querySelectorAll('#buscaDisp .chip').forEach(c => c.classList.toggle('on', c.dataset.d === 'todas')); filtrarAcervoAgora(); };
  $('#txtBusca').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); filtrarAcervoAgora(); } };
  const lista = $('#visaoListaAcervo'), grade = $('#visaoGradeAcervo'), btnL = $('#btnVisaoLista');
  if (lista && grade && !$('#visaoCapasAcervo')) { lista.insertAdjacentHTML('beforebegin', '<div id="visaoCapasAcervo" class="acervo-capas"></div>'); grade.insertAdjacentHTML('afterend', '<div id="acervoRodape" class="acervo-rodape"></div>'); }
  if (btnL && !$('#btnVisaoCapas')) btnL.insertAdjacentHTML('beforebegin', `<button type="button" class="${btnL.className.replace('active', '').trim()}" id="btnVisaoCapas" onclick="alternarVisaoAcervo('capas')"><i class="fa-solid fa-table-cells"></i> Capas</button>`);
  $('#visaoCapasAcervo')?.addEventListener('error', e => { if (e.target.tagName === 'IMG') e.target.replaceWith(Object.assign(document.createElement('div'), { className: 'capa-img ph', innerHTML: '<i class="fa-solid fa-book"></i>' })); }, true);
  const abrirCip = e => { const el = e.target.closest('.capa-link'); if (!el) return; if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); verCIP(+el.dataset.cip); };   // clicar/tocar na capa (ou Enter/Espaço) abre a CIP
  $('#visaoCapasAcervo')?.addEventListener('click', abrirCip); $('#visaoCapasAcervo')?.addEventListener('keydown', abrirCip);
  document.addEventListener('click', e => {
    if (e.target.closest('#btnOutras,#btnOutrasTopo')) { sortear((acervoCompleto || []).filter(l => !l.em_lixeira)); filtrarAcervoAgora(); $('.busca-adv')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    else if (e.target.closest('#btnMais')) { limite += 50; filtrarAcervoAgora(); }
  });
  window.alternarVisaoAcervo = modo => {
    const v = { capas: ['#visaoCapasAcervo', 'block'], lista: ['#visaoListaAcervo', 'flex'], grade: ['#visaoGradeAcervo', 'flex'] }; if (!v[modo]) modo = 'capas';
    Object.entries(v).forEach(([k, [sel, d]]) => { const el = $(sel); if (el) el.style.display = k === modo ? d : 'none'; }); const ids = { capas: '#btnVisaoCapas', lista: '#btnVisaoLista', grade: '#btnVisaoGrade' };
    Object.entries(ids).forEach(([k, sel]) => $(sel)?.classList.toggle('active', k === modo)); try { localStorage.setItem('rl_visao', modo); } catch (_) {}
  };
  alternarVisaoAcervo((() => { try { return localStorage.getItem('rl_visao'); } catch (_) { return null; } })() || 'capas');
  Promise.resolve(window.appReady).then(() => { opcoes(); filtrarAcervoAgora(); });
}
document.addEventListener('DOMContentLoaded', iniciar);
})();
