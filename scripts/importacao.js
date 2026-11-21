// Venous • Gestão › Importar / Exportar a base de dados (Biblivre, MARC, CSV, XLSX, JSON...).
(() => {
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)], esc = v => escaparHTML(v), IO = () => window.VenousIO, toast = (...a) => window.hubToast(...a);
const sb = () => window.supabaseClient, ehBib = () => typeof usuarioAtual !== 'undefined' && String(usuarioAtual?.cargo || '').toLowerCase() === 'bibliotecario';
const fmtN = n => Number(n).toLocaleString('pt-BR'), sleep = ms => new Promise(r => setTimeout(r, ms));
let E = null, pronto = false, rodando = false;                                          // E = análise do arquivo atual
const limpo = o => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('_')));

// ---------- Acesso ao banco ----------
async function todas(tabela, cols = '*') {
  if (!sb()) return { acervo: acervoCompleto, usuarios_sistema: listaUsuarios, emprestimos: listaEmprestimos, reservas: listaReservas }[tabela] || [];
  const out = []; for (let a = 0; ; a += 1000) { const { data, error } = await sb().from(tabela).select(cols).range(a, a + 999); if (error) { if (/does not exist|schema cache|relation/i.test(error.message)) return null; throw new Error(`${tabela}: ${error.message}`); } out.push(...data); if (data.length < 1000) break; }
  return out;
}
const semCol = {};
async function inserirLote(tabela, linhas, log) {                                         // insere; se faltar uma coluna no banco, remove-a e tenta de novo
  if (semCol[tabela]?.size) linhas = linhas.map(l => { const o = { ...l }; semCol[tabela].forEach(c => delete o[c]); return o; });
  let tent = 0; while (tent++ < 8) {
    const { data, error } = await sb().from(tabela).insert(linhas).select(); if (!error) return data;
    const m = /Could not find the '(\w+)' column/.exec(error.message || '') || /column "?(\w+)"? of relation/.exec(error.message || ''); if (!m) throw error;
    (semCol[tabela] ||= new Set()).add(m[1]); log(`Coluna “${m[1]}” não existe em ${tabela}; ignorada nesta importação.`, 'aviso'); linhas = linhas.map(l => { const { [m[1]]: _x, ...r } = l; return r; });
  }
  throw new Error('Não foi possível inserir em ' + tabela);
}

// ---------- Leitura e análise do arquivo ----------
async function analisar(file) {
  const buf = new Uint8Array(await file.arrayBuffer()), det = await IO().detectar(file.name, buf); E = { nome: file.name, tamanho: file.size, det, opc: { agrupar: true, historico: true, inativos: false, acervo: true, usuarios: true, emprestimos: true, reservas: true, simular: false } };
  if (det.tipo === 'biblivre') { const r = await IO().lerBiblivre(det.zip); E.meta = r.meta; E.tab = r.tab; }
  else if (det.tipo === 'pgdump') E.tab = IO().pgLer(det.texto, ['biblio_records', 'biblio_holdings', 'users', 'users_values', 'users_types', 'lendings', 'reservations']);
  else if (det.tipo === 'marc' || det.tipo === 'marcxml') E.acervoMarc = det.registros.map(m => ({ ...IO().marcParaAcervo(m, 'book'), numero_tombo: (m.campos.find(c => c.t === '949')?.s?.find(x => x[0] === 'a')?.[1]) || m.campos.find(c => c.t === '001')?.v || null, exemplares: 1, classificacao_geral: 'Geral', condicao_capa: 'Bom', em_lixeira: false, catalogador: 'Importado de MARC', data_reg: new Date().toISOString().slice(0, 10) }));
  else if (det.tipo === 'xlsx') { E.planilhas = det.planilhas; E.sheet = 0; E.linhas = det.planilhas[0]?.linhas || []; E.destino = 'acervo'; }
  else if (det.tipo === 'tabela') { E.linhas = det.linhas; E.destino = 'acervo'; }
  else if (det.tipo === 'csvzip') { E.backup = { tabelas: {} }; for (const n of det.arquivos) { const l = IO().csvParse(IO().decodificar(await det.zip.get(n).ler())).linhas, h = l[0] || []; E.backup.tabelas[n.split('/').pop().replace(/\.csv$/i, '')] = l.slice(1).map(r => Object.fromEntries(h.map((c, i) => [c, r[i] === '' ? null : r[i]]))); } }
  else if (det.tipo === 'venous') E.backup = det.backup;
  if (E.backup) { E.sel = {}; Object.keys(E.backup.tabelas).forEach(k => E.sel[k] = true); }
  return E;
}
const NOMES = { biblivre: 'Backup do Biblivre', pgdump: 'Dump PostgreSQL (Biblivre)', marc: 'MARC21 / ISO 2709', marcxml: 'MARCXML', xlsx: 'Planilha Excel (.xlsx)', tabela: 'Tabela (CSV / JSON)', venous: 'Backup R.A.I.L.D.A (JSON)', csvzip: 'Pacote CSV (ZIP)' };

// ---------- Conversão para o modelo do Venous ----------
function converter() {
  const o = E.opc, t = E.det.tipo;
  if (t === 'biblivre' || t === 'pgdump') { E.res = IO().biblivreParaVenous(E.tab, o); return E.res; }
  if (t === 'marc' || t === 'marcxml') return E.res = { acervo: E.acervoMarc, usuarios: [], emprestimos: [], reservas: [], credenciais: [] };
  if (t === 'xlsx' || t === 'tabela') { const mapa = E.mapa || (E.mapa = IO().mapearColunas(E.linhas[0] || [], E.destino)), objs = IO().linhasParaObjetos(E.linhas.slice(1), mapa, E.destino); return E.res = { acervo: E.destino === 'acervo' ? objs : [], usuarios: E.destino === 'usuarios' ? objs.map(u => ({ ...u, usuario: u.usuario || IO().slug(u.nome).slice(0, 20) + Math.floor(Math.random() * 90 + 10), senha: Math.random().toString(36).slice(2, 10), email: u.email || null })) : [], emprestimos: [], reservas: [], credenciais: [] }; }
  return E.res = null;
}

// ---------- Interface ----------
function desenhar() {
  const root = $('#ioRoot'); if (!ehBib()) { root.innerHTML = '<div class="hint"><i class="fa-solid fa-lock"></i> Importar e exportar a base de dados é exclusivo do cargo de bibliotecário.</div>'; return; }
  root.innerHTML = `<div class="io-grid">
  <div class="box"><h4><i class="fa-solid fa-file-import"></i> Importar base de dados</h4>
    <label class="io-drop" id="ioDrop"><i class="fa-solid fa-cloud-arrow-up"></i><b>Arraste o arquivo aqui ou toque para escolher</b><small class="muted">Biblivre (.b5bz) • MARC21 (.mrc/.iso) • MARCXML • CSV / TSV • Excel (.xlsx) • JSON do R.A.I.L.D.A • ZIP</small><input type="file" id="ioArq" hidden></label>
    <div id="ioAnalise"></div></div>
  <div class="box"><h4><i class="fa-solid fa-file-export"></i> Exportar base de dados</h4>
    <div class="io-opt">${[['acervo', 'Acervo (títulos e exemplares)'], ['usuarios_sistema', 'Usuários'], ['emprestimos', 'Empréstimos'], ['reservas', 'Reservas'], ['desbastes', 'Desbastes'], ['leituras_usuario', 'Leituras e histórico de páginas']].map(([k, n]) => `<label class="chk"><input type="checkbox" data-ex="${k}" ${['acervo', 'usuarios_sistema', 'emprestimos', 'reservas'].includes(k) ? 'checked' : ''}> ${n}</label>`).join('')}<label class="chk" style="color:var(--accent-red)"><input type="checkbox" id="exSenhas"> Incluir senhas dos usuários (não recomendado)</label></div>
    <div class="field"><label for="exFmt">Formato</label><select id="exFmt"><option value="json">Backup completo R.A.I.L.D.A (.json) — reimportável</option><option value="xlsx">Planilha Excel (.xlsx)</option><option value="csv">CSV (.zip com um arquivo por tabela)</option><option value="mrc">MARC21 (.mrc) — só o acervo</option><option value="marcxml">MARCXML (.xml) — só o acervo</option></select></div>
    <button class="btn btn-primary" id="exGo" style="width:100%"><i class="fa-solid fa-download"></i> Exportar</button><div class="hint" id="exMsg">O backup JSON preserva tudo e pode ser importado de volta aqui. MARC21 pode ser aberto em outros sistemas de biblioteca.</div></div></div>`;
  root.insertAdjacentHTML('beforeend', '<div id="capasRoot" style="margin-top:16px"></div><div class="box" style="margin-top:16px" id="ioHistBox"><h4><i class="fa-solid fa-clock-rotate-left"></i> Importações realizadas</h4><div id="ioHist"></div></div>');
  window.VenousCapas?.painel($('#capasRoot')); renderHist();
  const arq = $('#ioArq'), drop = $('#ioDrop'); arq.onchange = () => arq.files[0] && abrir(arq.files[0]);
  ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('on'); })); ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('on'); })); drop.addEventListener('drop', e => e.dataTransfer.files[0] && abrir(e.dataTransfer.files[0]));
  $('#exGo').onclick = exportar;
}
async function abrir(file) {
  const box = $('#ioAnalise'); box.innerHTML = `<div class="hint"><i class="fa-solid fa-spinner fa-spin"></i> Lendo ${esc(file.name)} (${(file.size / 1048576).toFixed(1)} MB)…</div>`; await sleep(30);
  try { await analisar(file); painel(); } catch (e) { box.innerHTML = `<div class="hint" style="color:var(--accent-red)"><i class="fa-solid fa-triangle-exclamation"></i> Não foi possível ler o arquivo: ${esc(e.message)}</div>`; E = null; }
}
function painel() {
  const box = $('#ioAnalise'), t = E.det.tipo, r = converter(), o = E.opc; let h = `<div class="io-det"><span class="st Concluida">${NOMES[t] || t}</span> <b>${esc(E.nome)}</b></div>`;
  if (E.meta) h += `<p class="muted" style="font-size:.85rem">Biblioteca: <b>${esc(E.meta.schemas?.single?.left || '')}</b> — ${esc(E.meta.schemas?.single?.right || '')} • backup de ${esc((E.meta.created || '').slice(0, 10))}</p>`;
  if (t === 'xlsx' && E.planilhas.length > 1) h += `<div class="field"><label>Planilha</label><select id="ioSheet">${E.planilhas.map((p, i) => `<option value="${i}" ${i === E.sheet ? 'selected' : ''}>${esc(p.nome)} (${p.linhas.length - 1} linhas)</option>`).join('')}</select></div>`;
  if (t === 'xlsx' || t === 'tabela') {
    const cab = E.linhas[0] || [], lista = IO().CAMPOS[E.destino];
    h += `<div class="field"><label>Importar como</label><select id="ioDest"><option value="acervo" ${E.destino === 'acervo' ? 'selected' : ''}>Acervo (livros)</option><option value="usuarios" ${E.destino === 'usuarios' ? 'selected' : ''}>Usuários</option></select></div><div class="lbl" style="margin:8px 0 4px">Relacione as colunas do arquivo aos campos do Venous</div><div class="io-map">${cab.map((c, i) => `<div class="io-m"><span>${esc(c || 'coluna ' + (i + 1))}</span><select data-col="${i}"><option value="">— ignorar —</option>${lista.map(([k, n]) => `<option value="${k}" ${E.mapa[i] === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`).join('')}</div>`;
  }
  if (E.backup) h += `<div class="io-opt">${Object.entries(E.backup.tabelas).map(([k, v]) => `<label class="chk"><input type="checkbox" data-bk="${k}" ${E.sel[k] ? 'checked' : ''}> ${esc(k)} <span class="muted">(${fmtN(v.length)})</span></label>`).join('')}</div>`;
  else if (r) {
    h += `<div class="kpis"><div class="kpi"><b>${fmtN(r.acervo.length)}</b><span>Títulos${r.exemplaresTotal ? ` • ${fmtN(r.exemplaresTotal)} exemplares` : ''}</span></div>${r.usuarios.length || t === 'biblivre' ? `<div class="kpi"><b>${fmtN(r.usuarios.length)}</b><span>Usuários${r.ignoradosUsuarios ? ` (${r.ignoradosUsuarios} inativos)` : ''}</span></div>` : ''}${r.emprestimos.length || t === 'biblivre' ? `<div class="kpi"><b>${fmtN(r.emprestimos.length)}</b><span>Empréstimos (${r.emprestimos.filter(x => x.status === 'Ativo').length} em aberto)</span></div>` : ''}${r.reservas.length || t === 'biblivre' ? `<div class="kpi"><b>${fmtN(r.reservas.length)}</b><span>Reservas</span></div>` : ''}</div>`;
    if (t === 'biblivre' || t === 'pgdump') h += `<div class="io-opt"><label class="chk"><input type="checkbox" data-o="acervo" ${o.acervo ? 'checked' : ''}> Acervo</label><label class="chk"><input type="checkbox" data-o="usuarios" ${o.usuarios ? 'checked' : ''}> Usuários</label><label class="chk"><input type="checkbox" data-o="emprestimos" ${o.emprestimos ? 'checked' : ''}> Empréstimos</label><label class="chk"><input type="checkbox" data-o="historico" ${o.historico ? 'checked' : ''}> + histórico de devolvidos</label><label class="chk"><input type="checkbox" data-o="reservas" ${o.reservas ? 'checked' : ''}> Reservas</label><label class="chk"><input type="checkbox" data-o="inativos" ${o.inativos ? 'checked' : ''}> Incluir usuários inativos/bloqueados</label></div>
      <div class="field"><label>Exemplares</label><select id="ioAgr"><option value="1" ${o.agrupar ? 'selected' : ''}>Um registro por título (vários exemplares no mesmo registro)</option><option value="0" ${!o.agrupar ? 'selected' : ''}>Um registro por exemplar (cada tombo separado)</option></select></div>`;
    h += `<div class="table-responsive"><table><thead><tr><th>Título</th><th>Autor</th><th>Tombo</th><th>Ex.</th></tr></thead><tbody>${r.acervo.slice(0, 4).map(a => `<tr><td data-label="Título"><b>${esc(a.titulo_principal)}</b></td><td data-label="Autor">${esc(a.nome_pessoal || a.autor_entidade || '—')}</td><td data-label="Tombo">${esc(a.numero_tombo || '—')}</td><td data-label="Ex.">${a.exemplares || 1}</td></tr>`).join('')}</tbody></table></div>`;
  }
  h += `<label class="chk" style="margin-top:10px"><input type="checkbox" id="ioSim" ${o.simular ? 'checked' : ''}> Apenas simular (não grava nada)</label>${!sb() ? '<div class="hint"><i class="fa-solid fa-plug-circle-xmark"></i> Sem conexão com o Supabase: só é possível simular.</div>' : ''}
    <div class="btn-group" style="margin-top:12px"><button class="btn btn-primary" id="ioGo"><i class="fa-solid fa-file-import"></i> Iniciar importação</button><button class="btn btn-outline" id="ioCancel">Cancelar</button></div><div id="ioProg" class="hidden"><div class="io-prog"><i id="ioBar"></i></div><div id="ioStep" class="muted" style="font-size:.82rem"></div></div><div id="ioLog" class="io-log"></div>`;
  box.innerHTML = h; ligar();
}
function ligar() {
  const box = $('#ioAnalise');
  box.onchange = e => { const t = e.target; if (t.dataset.o) E.opc[t.dataset.o] = t.checked; else if (t.id === 'ioAgr') E.opc.agrupar = t.value === '1'; else if (t.id === 'ioSim') E.opc.simular = t.checked; else if (t.dataset.bk) E.sel[t.dataset.bk] = t.checked;
    else if (t.id === 'ioDest') { E.destino = t.value; E.mapa = null; } else if (t.id === 'ioSheet') { E.sheet = +t.value; E.linhas = E.planilhas[E.sheet].linhas; E.mapa = null; } else if (t.dataset.col !== undefined) { E.mapa[+t.dataset.col] = t.value; } else return; painel(); };
  $('#ioGo').onclick = executar; $('#ioCancel').onclick = () => { E = null; box.innerHTML = ''; $('#ioArq').value = ''; };
}

// ---------- Importação ----------
const logs = []; function log(m, tipo) { logs.push([m, tipo]); const l = $('#ioLog'); if (l) l.insertAdjacentHTML('beforeend', `<div class="${tipo || ''}">${tipo === 'erro' ? '✖' : tipo === 'aviso' ? '⚠' : '•'} ${esc(m)}</div>`); l?.scrollTo(0, 1e9); }
const prog = (p, t) => { $('#ioProg').classList.remove('hidden'); $('#ioBar').style.width = Math.round(p * 100) + '%'; $('#ioStep').textContent = t; };
async function importarNovos(tabela, linhas, chaveFn, existentes, etapa, p0, p1, sim) {   // dedupe + lotes; devolve {novos, ignorados, erros}
  const r = { novos: 0, ignorados: 0, erros: 0 }, ja = new Set(), aInserir = [];
  linhas.forEach(l => { const k = chaveFn(l); if (k && (existentes.has(k) || ja.has(k))) { r.ignorados++; if (existentes.has(k)) l._novoId = existentes.get(k); return; } if (k) ja.add(k); aInserir.push(l); });
  log(`${etapa}: ${fmtN(aInserir.length)} novos, ${fmtN(r.ignorados)} já existentes (ignorados).`);
  if (sim) { r.novos = aInserir.length; return r; }
  for (let i = 0; i < aInserir.length; i += 100) {
    const lote = aInserir.slice(i, i + 100), carga = lote.map(limpo); prog(p0 + (p1 - p0) * (i / Math.max(1, aInserir.length)), `${etapa}: ${fmtN(Math.min(i + 100, aInserir.length))} de ${fmtN(aInserir.length)}`);
    try { const dados = await inserirLote(tabela, carga, log); dados.forEach((d, j) => { lote[j]._novoId = d.id; lote[j]._criado = true; }); (E.ids[tabela] ||= []).push(...dados.map(d => d.id)); r.novos += dados.length; }
    catch (e) { for (const [j, l] of lote.entries()) { try { const d = await inserirLote(tabela, [limpo(l)], () => {}); l._novoId = d[0].id; l._criado = true; (E.ids[tabela] ||= []).push(d[0].id); r.novos++; } catch (x) { r.erros++; if (r.erros <= 20) log(`${etapa}: “${l.titulo_principal || l.nome || ''}” não importado (${x.message})`, 'erro'); } } }
    await sleep(0);
  }
  return r;
}
async function executar() {
  if (rodando || !E) return; if (!ehBib()) return; const sim = E.opc.simular || !sb(); if (!sim && !await confirmarAcao('Importar para a base de dados?', 'Os registros novos serão gravados no banco. Itens já existentes (mesmo tombo/usuário) serão ignorados, não sobrescritos.', 'Importar')) return;
  rodando = true; E.ids = {}; Object.keys(semCol).forEach(k => delete semCol[k]); logs.length = 0; $('#ioLog').innerHTML = ''; $('#ioGo').disabled = true; const res = {};
  try {
    if (E.backup) await importarBackup(sim, res); else await importarGenerico(sim, res);
    prog(1, sim ? 'Simulação concluída' : 'Importação concluída'); if (!sim) await registrarImportacao(res); finalizar(sim, res);
  } catch (e) { log('Falha: ' + e.message, 'erro'); toast('Importação interrompida: ' + e.message, 'erro'); } finally { rodando = false; $('#ioGo').disabled = false; }
}
async function mapaExistentes(tabela, cols, chaves) {                                      // chave natural (tombo, login, origem_id...) -> id existente
  const m = new Map(); let l = await todas(tabela, cols); if (l === null && /origem_id/.test(cols)) l = await todas(tabela, cols.replace(',origem_id', '')); (l || []).forEach(x => chaves(x).forEach(k => k && m.set(k, x.id))); return m;
}
const gerarSenha = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), x => 'abcdefghjkmnpqrstuvwxyz23456789'[x % 31]).join('');
async function gravarEmprestimosReservas(emp, res_, sim, p0) {                                  // dedupe + gravação de empréstimos e reservas já com ids resolvidos
  if (emp?.length) { const ms = d => Date.parse(d) || 0, ex = await todas('emprestimos', 'livro_id,usuario_id,data_emprestimo') || [], k = new Set(ex.map(x => `${x.livro_id}|${x.usuario_id}|${ms(x.data_emprestimo)}`)), lin = [];
    emp.forEach(e => { if (!e.livro_id || !e.usuario_id) { if (sim) lin.push(e); return; } const c = `${e.livro_id}|${e.usuario_id}|${ms(e.data_emprestimo)}`; if (k.has(c)) return; k.add(c); lin.push(e); }); res.emprestimos = await insSimples('emprestimos', lin, 'Empréstimos', p0, p0 + 0.08, sim); res.emprestimos.ignorados = emp.length - lin.length; }
  if (res_?.length) { const ms = d => Date.parse(d) || 0, ex = await todas('reservas', 'livro_id,usuario_id,data_reserva') || [], k = new Set(ex.map(x => `${x.livro_id}|${x.usuario_id}|${ms(x.data_reserva)}`)), lin = res_.filter(e => (e.livro_id && e.usuario_id) ? !k.has(`${e.livro_id}|${e.usuario_id}|${ms(e.data_reserva)}`) : sim);
    res.reservas = await insSimples('reservas', lin, 'Reservas', p0 + 0.08, p0 + 0.12, sim); res.reservas.ignorados = res_.length - lin.length; }
}
let res = {};
async function importarGenerico(sim, resultado) {
  res = resultado; const o = E.opc, r = E.res; prog(0.02, 'Verificando registros existentes…');
  const exA = await mapaExistentes('acervo', 'id,numero_tombo,origem_id', x => [x.numero_tombo, x.origem_id]), exU = await mapaExistentes('usuarios_sistema', 'id,usuario,origem_id', x => [x.usuario, x.origem_id]);
  if (o.acervo !== false && r.acervo.length) res.acervo = await importarNovos('acervo', r.acervo, l => (l.origem_id && exA.has(l.origem_id)) ? l.origem_id : l.numero_tombo, exA, 'Acervo', 0.05, 0.6, sim);
  if (o.usuarios !== false && r.usuarios.length) res.usuarios_sistema = await importarNovos('usuarios_sistema', r.usuarios, l => (l.origem_id && exU.has(l.origem_id)) ? l.origem_id : l.usuario, exU, 'Usuários', 0.6, 0.78, sim);
  const criados = new Set(r.usuarios.filter(u => u._criado).map(u => u.usuario)); E.credenciais = (r.credenciais || []).filter(c => criados.has(c.usuario));
  const emp = o.emprestimos !== false ? r.emprestimos.map(e => ({ livro_id: e._livro._novoId, usuario_id: e._usuario._novoId, data_emprestimo: e.data_emprestimo, data_devolucao_prevista: e.data_devolucao_prevista, status: e.status })) : [];
  const rsv = o.reservas !== false ? r.reservas.map(e => ({ livro_id: e._livro._novoId, usuario_id: e._usuario._novoId, data_reserva: e.data_reserva, status: e.status })) : [];
  await gravarEmprestimosReservas(emp, rsv, sim, 0.8);
}
async function insSimples(tabela, lin, etapa, p0, p1, sim) {
  const r = { novos: 0, ignorados: 0, erros: 0 }; log(`${etapa}: ${fmtN(lin.length)} a gravar.`); if (sim) { r.novos = lin.length; return r; }
  for (let i = 0; i < lin.length; i += 100) { prog(p0 + (p1 - p0) * (i / Math.max(1, lin.length)), `${etapa}: ${Math.min(i + 100, lin.length)} de ${lin.length}`); try { const d = await inserirLote(tabela, lin.slice(i, i + 100), log); r.novos += d.length; (E.ids[tabela] ||= []).push(...d.map(x => x.id)); } catch (e) { r.erros += Math.min(100, lin.length - i); log(`${etapa}: ${e.message}`, 'erro'); } }
  return r;
}
async function importarBackup(sim, resultado) {                                              // backup JSON do R.A.I.L.D.A / pacote CSV: refaz os vínculos pelos ids antigos
  res = resultado; const T = E.backup.tabelas, on = k => E.sel[k] && T[k]?.length; prog(0.02, 'Verificando registros existentes…');
  const exA = await mapaExistentes('acervo', 'id,numero_tombo,origem_id', x => [x.numero_tombo, x.origem_id]), exU = await mapaExistentes('usuarios_sistema', 'id,usuario,origem_id', x => [x.usuario, x.origem_id]);
  const A = on('acervo') ? T.acervo.map(({ id, ...r }) => ({ ...r, _old: id })) : [], U = on('usuarios_sistema') ? T.usuarios_sistema.map(({ id, ...r }) => ({ ...r, senha: r.senha || gerarSenha(), _old: id, _semSenha: !r.senha })) : [];
  if (A.length) res.acervo = await importarNovos('acervo', A, l => l.numero_tombo, exA, 'Acervo', 0.05, 0.4, sim);
  if (U.length) res.usuarios_sistema = await importarNovos('usuarios_sistema', U, l => l.usuario, exU, 'Usuários', 0.4, 0.55, sim);
  E.credenciais = U.filter(u => u._criado && u._semSenha).map(u => ({ nome: u.nome, usuario: u.usuario, senha: u.senha, email: u.email || '' }));
  const mA = new Map(A.map(a => [String(a._old), a._novoId])), mU = new Map(U.map(u => [String(u._old), u._novoId])), dep = (k) => { if (on(k) && (!mA.size || !mU.size)) log(`${k}: precisa importar também Acervo e Usuários (os vínculos dependem deles). Tabela ignorada.`, 'aviso'); return on(k) && mA.size && mU.size; };
  const emp = dep('emprestimos') ? T.emprestimos.map(x => ({ livro_id: mA.get(String(x.livro_id)), usuario_id: mU.get(String(x.usuario_id)), data_emprestimo: x.data_emprestimo, data_devolucao_prevista: x.data_devolucao_prevista, status: x.status })) : [];
  const rsv = dep('reservas') ? T.reservas.map(x => ({ livro_id: mA.get(String(x.livro_id)), usuario_id: mU.get(String(x.usuario_id)), data_reserva: x.data_reserva, status: x.status })) : [];
  await gravarEmprestimosReservas(emp, rsv, sim, 0.6);
  if (on('desbastes')) { const ex = await todas('desbastes', 'titulo,created_at') || [], k = new Set(ex.map(x => `${x.titulo}|${x.created_at}`)); const lin = T.desbastes.map(({ id, ...r }) => ({ ...r, livro_id: mA.get(String(r.livro_id)) ?? null })).filter(x => !k.has(`${x.titulo}|${x.created_at}`)); res.desbastes = await insSimples('desbastes', lin, 'Desbastes', 0.85, 0.95, sim); res.desbastes.ignorados = T.desbastes.length - lin.length; }
  ['leituras_usuario', 'historico_paginas'].forEach(k => { if (on(k)) log(`${k}: dados pessoais de leitura ficam apenas no backup (não são reimportados).`, 'aviso'); });
}

// ---------- Resultado ----------
function finalizar(sim, res) {
  const lin = Object.entries(res).map(([k, v]) => `<tr><td data-label="Tabela"><b>${k}</b></td><td data-label="${sim ? 'Seriam gravados' : 'Gravados'}">${fmtN(v.novos)}</td><td data-label="Já existiam">${fmtN(v.ignorados)}</td><td data-label="Erros">${fmtN(v.erros)}</td></tr>`).join('');
  $('#ioLog').insertAdjacentHTML('beforebegin', `<div class="box" style="margin-top:12px"><h4>${sim ? 'Resultado da simulação' : '✅ Importação concluída'}</h4><div class="table-responsive"><table><thead><tr><th>Tabela</th><th>${sim ? 'Seriam gravados' : 'Gravados'}</th><th>Já existiam</th><th>Erros</th></tr></thead><tbody>${lin}</tbody></table></div>
  <div class="btn-group" style="margin-top:10px">${E.credenciais?.length && !sim ? '<button class="btn btn-outline btn-sm" id="ioCred"><i class="fa-solid fa-key"></i> Baixar logins e senhas temporárias</button>' : ''}${logs.some(l => l[1] === 'erro') ? '<button class="btn btn-outline btn-sm" id="ioErros"><i class="fa-solid fa-file-csv"></i> Baixar erros</button>' : ''}</div>${E.credenciais?.length && !sim ? '<p class="muted" style="font-size:.8rem">Os usuários importados receberam senhas aleatórias. Guarde o arquivo e peça para trocarem a senha no primeiro acesso.</p>' : ''}</div>`);
  $('#ioCred')?.addEventListener('click', () => baixar(IO().bytes(IO().csvTexto(IO().objetosParaLinhas(E.credenciais, ['nome', 'usuario', 'senha', 'email']))), 'logins-importados.csv', 'text/csv'));
  $('#ioErros')?.addEventListener('click', () => baixar(IO().bytes(IO().csvTexto(logs.filter(l => l[1] === 'erro').map(l => [l[0]]))), 'erros-importacao.csv', 'text/csv'));
  if (!sim) { toast('Importação concluída!'); ['carregarAcervo', 'carregarUsuarios', 'carregarEmprestimos', 'carregarReservas'].forEach(f => { try { window[f]?.(); } catch (_) {} }); }
}

// ---------- Importações realizadas e "apagar tudo que veio por importação" ----------
const LK = 'venous_importacoes', lerLocal = () => { try { return JSON.parse(localStorage.getItem(LK)) || []; } catch (_) { return []; } }, gravarLocal = l => { try { localStorage.setItem(LK, JSON.stringify(l)); } catch (_) {} };
async function carregarImportacoes() {
  let db = []; if (sb()) { try { const { data, error } = await sb().from('importacoes').select('*').order('criado_em', { ascending: false }); if (!error) db = data || []; } catch (_) {} }
  const m = new Map(); [...lerLocal(), ...db].forEach(i => m.set(i.uid, { ...(m.get(i.uid) || {}), ...i })); return [...m.values()].sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
}
async function salvarImportacao(imp) {
  gravarLocal([...lerLocal().filter(x => x.uid !== imp.uid), imp]);
  if (sb()) { try { await sb().from('importacoes').upsert([{ uid: imp.uid, arquivo: imp.arquivo, formato: imp.formato, contagens: imp.contagens, ids: imp.ids, criado_por: imp.criado_por, criado_em: imp.criado_em, apagado_em: imp.apagado_em || null }], { onConflict: 'uid' }); } catch (_) {} }
}
async function registrarImportacao(res) {
  const total = Object.values(E.ids).reduce((s, a) => s + a.length, 0); if (!total) return;
  await salvarImportacao({ uid: (crypto.randomUUID && crypto.randomUUID()) || 'imp-' + Date.now(), arquivo: E.nome, formato: NOMES[E.det.tipo] || E.det.tipo, criado_em: new Date().toISOString(), criado_por: usuarioAtual.id, contagens: Object.fromEntries(Object.entries(res).map(([k, v]) => [k, v.novos])), ids: E.ids, apagado_em: null }); renderHist();
}
const resumoImp = c => Object.entries(c || {}).filter(([, v]) => v).map(([k, v]) => `${fmtN(v)} ${({ acervo: 'livros', usuarios_sistema: 'usuários', emprestimos: 'empréstimos', reservas: 'reservas', desbastes: 'desbastes' })[k] || k}`).join(' • ') || 'sem registros';
async function renderHist() {
  const box = $('#ioHist'); if (!box) return; const l = await carregarImportacoes(), ativas = l.filter(i => !i.apagado_em);
  box.innerHTML = (l.length ? l.map(i => `<div class="io-imp ${i.apagado_em ? 'off' : ''}"><div><b>${esc(i.arquivo)}</b> <span class="st ${i.apagado_em ? '' : 'Concluida'}">${i.apagado_em ? 'Apagada' : 'Ativa'}</span><br><small class="muted">${new Date(i.criado_em).toLocaleString('pt-BR')} • ${resumoImp(i.contagens)}</small></div>${i.apagado_em ? '' : `<button class="btn btn-danger btn-sm" data-imp="${esc(i.uid)}"><i class="fa-solid fa-trash"></i> Apagar tudo desta importação</button>`}</div>`).join('') : '<p class="muted" style="font-size:.88rem">Nenhuma importação registrada ainda.</p>')
    + `<div class="btn-group" style="margin-top:12px">${ativas.length ? '<button class="btn btn-danger" id="impTudo"><i class="fa-solid fa-triangle-exclamation"></i> Apagar TUDO que veio por importação</button>' : ''}<button class="btn btn-outline btn-sm" id="impLegado"><i class="fa-solid fa-magnifying-glass"></i> Procurar importações antigas (sem registro)</button></div><div id="impProg" class="hidden"><div class="io-prog"><i id="impBar"></i></div><div id="impTxt" class="muted" style="font-size:.82rem"></div></div>`;
  box.onclick = async e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.imp) apagarImportacoes(l.filter(i => i.uid === b.dataset.imp)); else if (b.id === 'impTudo') apagarImportacoes(ativas); else if (b.id === 'impLegado') procurarAntigas(); };
}
function confirmarDigitando(titulo, texto, palavra) {
  return new Promise(ok => { let m = $('#modalApagar'); if (!m) { m = document.createElement('div'); m.id = 'modalApagar'; m.className = 'modal-overlay'; m.style.zIndex = 1100; document.body.appendChild(m); }
    m.innerHTML = `<div class="modal-box"><h3 style="color:var(--accent-red)"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(titulo)}</h3><p style="margin:10px 0">${esc(texto)}</p><label class="cf"><span>Digite <b>${palavra}</b> para confirmar</span><input id="apIn" autocomplete="off"></label><div class="btn-group" style="justify-content:flex-end;margin-top:14px"><button class="btn btn-outline" id="apNo">Cancelar</button><button class="btn btn-danger" id="apYes" disabled>Apagar definitivamente</button></div></div>`; m.classList.add('active');
    const fim = v => { m.classList.remove('active'); ok(v); }; $('#apIn').oninput = e => { $('#apYes').disabled = e.target.value.trim().toUpperCase() !== palavra; }; $('#apNo').onclick = () => fim(false); $('#apYes').onclick = () => fim(true); $('#apIn').focus(); });
}
async function apagarImportacoes(lista) {
  if (!lista.length || rodando) return; if (!ehBib()) return; if (!sb()) return toast('Apagar exige conexão com o Supabase.', 'erro');
  const ids = { acervo: [], usuarios_sistema: [], emprestimos: [], reservas: [] }; lista.forEach(i => Object.keys(ids).forEach(k => ids[k].push(...(i.ids?.[k] || [])))); Object.keys(ids).forEach(k => ids[k] = [...new Set(ids[k])]);
  const txt = `Serão apagados definitivamente: ${fmtN(ids.acervo.length)} livros, ${fmtN(ids.usuarios_sistema.length)} usuários, ${fmtN(ids.emprestimos.length)} empréstimos e ${fmtN(ids.reservas.length)} reservas que vieram por importação — e também qualquer empréstimo ou reserva criado depois que envolva esses livros ou usuários. Não dá para desfazer.`;
  if (!await confirmarDigitando('Apagar tudo que veio por importação?', txt, 'APAGAR')) return;
  rodando = true; const erros = [], etapas = [['emprestimos', 'id', ids.emprestimos], ['emprestimos', 'livro_id', ids.acervo], ['emprestimos', 'usuario_id', ids.usuarios_sistema], ['reservas', 'id', ids.reservas], ['reservas', 'livro_id', ids.acervo], ['reservas', 'usuario_id', ids.usuarios_sistema], ['acervo', 'id', ids.acervo], ['usuarios_sistema', 'id', ids.usuarios_sistema]], total = etapas.reduce((s, e) => s + e[2].length, 0) || 1; let feito = 0; $('#impProg').classList.remove('hidden');
  for (const [tabela, col, arr] of etapas) for (let i = 0; i < arr.length; i += 100) { const { error } = await sb().from(tabela).delete().in(col, arr.slice(i, i + 100)); if (error) erros.push(`${tabela}: ${error.message}`); feito += Math.min(100, arr.length - i); $('#impBar').style.width = Math.round(feito / total * 100) + '%'; $('#impTxt').textContent = `Apagando ${tabela}… ${fmtN(feito)} de ${fmtN(total)}`; }
  rodando = false;
  if (erros.length) { $('#impTxt').innerHTML = `<span style="color:var(--accent-red)">Não foi possível apagar tudo: ${esc([...new Set(erros)].slice(0, 3).join(' | '))}</span>`; return toast('Apagado parcialmente. Veja a mensagem de erro.', 'erro'); }
  for (const i of lista) { i.apagado_em = new Date().toISOString(); await salvarImportacao(i); }
  ['carregarAcervo', 'carregarUsuarios', 'carregarEmprestimos', 'carregarReservas'].forEach(f => { try { window[f]?.(); } catch (_) {} }); toast('Tudo que veio por importação foi apagado.'); renderHist(); window.VenousCapas && $('#capasRoot') && window.VenousCapas.painel($('#capasRoot'));
}
async function procurarAntigas() {                                                         // acha importações feitas antes do registro existir: pela marca “Importado…”, por origem_id e, se houver arquivo carregado, por tombo/login iguais
  if (!sb()) return toast('Precisa de conexão com o Supabase.', 'erro'); const ac = new Set(), us = new Set();
  (await todas('acervo', 'id,catalogador') || []).filter(x => /^Importado/.test(x.catalogador || '')).forEach(x => ac.add(x.id));
  (await todas('usuarios_sistema', 'id,origem_id') || []).filter(x => /^biblivre:/.test(x.origem_id || '')).forEach(x => us.add(x.id));
  if (E?.res) { const tA = new Map(E.res.acervo.map(a => [a.numero_tombo, a.titulo_principal])), tU = new Map(E.res.usuarios.map(u => [u.usuario, u.nome]));
    (await todas('acervo', 'id,numero_tombo,titulo_principal') || []).filter(x => tA.get(x.numero_tombo) === x.titulo_principal).forEach(x => ac.add(x.id)); (await todas('usuarios_sistema', 'id,usuario,nome') || []).filter(x => tU.get(x.usuario) === x.nome).forEach(x => us.add(x.id)); }
  const jaReg = new Set((await carregarImportacoes()).filter(i => !i.apagado_em).flatMap(i => i.ids?.acervo || [])), A = [...ac].filter(i => !jaReg.has(i)), U = [...us];
  if (!A.length && !U.length) return toast(E?.res ? 'Nenhuma importação antiga encontrada.' : 'Nada encontrado. Dica: carregue acima o mesmo arquivo que você importou e tente de novo — assim usuários antigos também são localizados.');
  await salvarImportacao({ uid: 'legado-' + Date.now(), arquivo: 'Importações antigas (sem registro)', formato: 'Localizado automaticamente', criado_em: new Date().toISOString(), criado_por: usuarioAtual.id, contagens: { acervo: A.length, usuarios_sistema: U.length }, ids: { acervo: A, usuarios_sistema: U }, apagado_em: null });
  toast(`Encontrados ${fmtN(A.length)} livros e ${fmtN(U.length)} usuários. Use “Apagar tudo desta importação”.`); renderHist();
}

// ---------- Exportação ----------
function baixar(dados, nome, tipo) { const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([dados], { type: tipo })), download: nome }); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
async function exportar() {
  const sel = $$('[data-ex]:checked').map(x => x.dataset.ex), fmt = $('#exFmt').value, msg = $('#exMsg'), btn = $('#exGo'); if (!sel.length) return toast('Escolha ao menos uma tabela.', 'erro');
  btn.disabled = true; msg.textContent = 'Reunindo os dados…'; const hoje = new Date().toISOString().slice(0, 10);
  try {
    const dados = {}; for (const t of (fmt === 'mrc' || fmt === 'marcxml') ? ['acervo'] : sel) { let l = await todas(t); if (l === null) { msg.textContent += ` (tabela ${t} não existe e foi pulada)`; continue; } if (t === 'usuarios_sistema' && !$('#exSenhas').checked) l = l.map(({ senha, ...r }) => r); if (t === 'leituras_usuario') { dados.historico_paginas = await todas('historico_paginas') || []; } dados[t] = l.map(limpo); }
    const total = Object.values(dados).reduce((s, v) => s + v.length, 0);
    if (fmt === 'json') baixar(JSON.stringify({ formato: 'railda-backup', versao: 1, gerado_em: new Date().toISOString(), tabelas: dados }), `railda-backup-${hoje}.json`, 'application/json');
    else if (fmt === 'xlsx') baixar(IO().xlsxCriar(Object.entries(dados).map(([k, v]) => ({ nome: k, linhas: IO().objetosParaLinhas(v) }))), `railda-${hoje}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    else if (fmt === 'csv') baixar(IO().criarZip(Object.entries(dados).map(([k, v]) => ({ nome: k + '.csv', dados: IO().bytes(IO().csvTexto(IO().objetosParaLinhas(v))) }))), `railda-csv-${hoje}.zip`, 'application/zip');
    else if (fmt === 'mrc') baixar(IO().marcEscrever((dados.acervo || []).map(IO().acervoParaMarc)), `acervo-${hoje}.mrc`, 'application/marc');
    else baixar(IO().marcXmlEscrever((dados.acervo || []).map(IO().acervoParaMarc)), `acervo-${hoje}.xml`, 'application/xml');
    msg.textContent = `Exportação concluída: ${fmtN(total)} registro(s).`; toast('Exportação concluída!');
  } catch (e) { msg.textContent = 'Erro: ' + e.message; toast(e.message, 'erro'); } finally { btn.disabled = false; }
}
window.initDados = () => { if (!$('#ioRoot')) return; if (!pronto) pronto = true; desenhar(); };
})();
