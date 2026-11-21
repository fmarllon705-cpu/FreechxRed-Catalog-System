// Venous • Formatos de importação/exportação (sem dependências externas; funciona no navegador e no Node).
// Lê: Biblivre (.b5bz/.b5b/.sql), ZIP, MARC21/ISO2709 (.mrc/.iso), MARCXML, CSV/TSV, XLSX, JSON (backup Venous).
// Grava: JSON, CSV (ZIP), XLSX, MARC21 (.mrc), MARCXML.
(() => {
const TD = (enc, fatal) => new TextDecoder(enc, { fatal: !!fatal }), TE = new TextEncoder();
const GS = '\x1d', RS = '\x1e', US = '\x1f';

// ---------- texto e bytes ----------
function decodificar(u8) {
  let t; try { t = TD('utf-8', true).decode(u8); } catch (_) { t = TD('windows-1252').decode(u8); }
  return t.charCodeAt(0) === 0xFEFF ? t.slice(1) : t;
}
const bytes = s => TE.encode(s), slug = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const xmlEsc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
const xmlUnesc = s => String(s).replace(/&(#x?[0-9a-f]+|lt|gt|amp|quot|apos);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }[e.toLowerCase()]);

// ---------- ZIP (leitura com DecompressionStream; escrita sem compressão) ----------
async function inflar(raw) { return new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()); }
async function lerZip(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength); let e = u8.length - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--; if (e < 0) throw new Error('Arquivo ZIP inválido.');
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out = new Map();
  for (let i = 0; i < n; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const metodo = dv.getUint16(p + 10, true), cs = dv.getUint32(p + 20, true), us = dv.getUint32(p + 24, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
    const nome = TD('utf-8').decode(u8.subarray(p + 46, p + 46 + nl)); p += 46 + nl + el + cl; if (nome.endsWith('/')) continue;
    const ini = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true), raw = u8.subarray(ini, ini + cs);
    out.set(nome, { nome, tamanho: us, ler: async () => metodo === 0 ? raw : inflar(raw) });
  }
  return out;
}
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function criarZip(arquivos) {                                                         // [{nome, dados:Uint8Array}] -> Uint8Array (método "store")
  const partes = [], central = []; let pos = 0, d = new Date(); const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), data = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const f of arquivos) {
    const nome = bytes(f.nome), crc = crc32(f.dados), h = new DataView(new ArrayBuffer(30)); [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, hora, 2], [12, data, 2], [14, crc, 4], [18, f.dados.length, 4], [22, f.dados.length, 4], [26, nome.length, 2], [28, 0, 2]].forEach(([o, v, s]) => s === 4 ? h.setUint32(o, v, true) : h.setUint16(o, v, true));
    const c = new DataView(new ArrayBuffer(46)); [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, hora, 2], [14, data, 2], [16, crc, 4], [20, f.dados.length, 4], [24, f.dados.length, 4], [28, nome.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, pos, 4]].forEach(([o, v, s]) => s === 4 ? c.setUint32(o, v, true) : c.setUint16(o, v, true));
    partes.push(new Uint8Array(h.buffer), nome, f.dados); central.push(new Uint8Array(c.buffer), nome); pos += 30 + nome.length + f.dados.length;
  }
  const tc = central.reduce((s, x) => s + x.length, 0), fim = new DataView(new ArrayBuffer(22)); fim.setUint32(0, 0x06054b50, true); fim.setUint16(8, arquivos.length, true); fim.setUint16(10, arquivos.length, true); fim.setUint32(12, tc, true); fim.setUint32(16, pos, true);
  const todos = [...partes, ...central, new Uint8Array(fim.buffer)], out = new Uint8Array(todos.reduce((s, x) => s + x.length, 0)); let o = 0; todos.forEach(x => { out.set(x, o); o += x.length; }); return out;
}

// ---------- CSV / TSV ----------
function detectarDelimitador(t) { const l = t.split(/\r?\n/, 1)[0] || ''; return [';', '\t', ',', '|'].map(d => [d, l.split(d).length]).sort((a, b) => b[1] - a[1])[0][0]; }
function csvParse(t, d) {
  d = d || detectarDelimitador(t); const rows = []; let r = [], c = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else if (ch === '"' && c === '') q = true; else if (ch === d) { r.push(c); c = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; r.push(c); c = ''; if (r.length > 1 || r[0] !== '') rows.push(r); r = []; } else c += ch;
  }
  if (c !== '' || r.length) { r.push(c); rows.push(r); } return { delimitador: d, linhas: rows };
}
const csvLinha = (r, d) => r.map(v => { v = v === null || v === undefined ? '' : String(v); return /["\n\r;,\t]/.test(v) || v.startsWith(' ') ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(d || ';');
const csvTexto = (linhas, d) => '\ufeff' + linhas.map(r => csvLinha(r, d)).join('\r\n');
const objetosParaLinhas = (objs, cols) => { cols = cols || [...new Set(objs.flatMap(o => Object.keys(o)))]; return [cols, ...objs.map(o => cols.map(c => typeof o[c] === 'object' && o[c] !== null ? JSON.stringify(o[c]) : o[c]))]; };

// ---------- XLSX ----------
const colNum = ref => { const m = /^([A-Z]+)/.exec(ref)[1]; let n = 0; for (const ch of m) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
const colRef = n => { let s = ''; for (n++; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; };
async function xlsxLer(buf) {
  const z = await lerZip(buf), txt = async n => z.has(n) ? decodificar(await z.get(n).ler()) : '';
  const ss = [...(await txt('xl/sharedStrings.xml')).matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => xmlUnesc([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join('')));
  const nomes = [...(await txt('xl/workbook.xml')).matchAll(/<sheet [^>]*name="([^"]*)"/g)].map(m => xmlUnesc(m[1])), arqs = [...z.keys()].filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.match(/(\d+)\.xml/)[1]) - parseInt(b.match(/(\d+)\.xml/)[1])), out = [];
  for (let i = 0; i < arqs.length; i++) {
    const rows = [];
    for (const rm of (await txt(arqs[i])).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const r = [];
      for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const at = cm[1], ref = /r="([A-Z]+\d+)"/.exec(at)?.[1], t = /t="(\w+)"/.exec(at)?.[1], inner = cm[2] || ''; if (!ref) continue; let v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
        if (t === 's') v = ss[+v]; else if (t === 'inlineStr') v = xmlUnesc([...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join('')); else if (v !== undefined) v = xmlUnesc(v);
        r[colNum(ref)] = v ?? '';
      }
      rows.push(Array.from(r, x => x ?? ''));
    }
    out.push({ nome: nomes[i] || 'Planilha' + (i + 1), linhas: rows });
  }
  return out;
}
function xlsxCriar(planilhas) {
  const nomeOk = (n, i) => String(n || 'Planilha' + (i + 1)).replace(/[\[\]:*?\/\\]/g, ' ').slice(0, 31) || 'Planilha' + (i + 1);
  const cel = (v, r, c) => { const ref = colRef(c) + (r + 1); if (v === null || v === undefined || v === '') return ''; return typeof v === 'number' && isFinite(v) ? `<c r="${ref}"><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`; };
  const f = [{ nome: '[Content_Types].xml', dados: bytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${planilhas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`) },
    { nome: '_rels/.rels', dados: bytes('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>') },
    { nome: 'xl/workbook.xml', dados: bytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${planilhas.map((p, i) => `<sheet name="${xmlEsc(nomeOk(p.nome, i))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`) },
    { nome: 'xl/_rels/workbook.xml.rels', dados: bytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${planilhas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`) }];
  planilhas.forEach((p, i) => f.push({ nome: `xl/worksheets/sheet${i + 1}.xml`, dados: bytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${p.linhas.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => cel(v, ri, ci)).join('')}</row>`).join('')}</sheetData></worksheet>`) }));
  return criarZip(f);
}

// ---------- MARC21 (ISO 2709) e MARCXML ----------
function marcRegistro(texto) {                                                        // lê pelo diretório/terminadores (não depende do tamanho do leader: tolera UTF-8 x bytes)
  const iso = texto.replace(/[\x1d\r\n]+$/g, ''), i = iso.indexOf(RS); if (i < 24) return null;
  const n = Math.floor((i - 24) / 12), dir = iso.slice(24, i), dados = iso.slice(i + 1).split(RS), campos = [];
  for (let k = 0; k < n; k++) { const t = dir.slice(k * 12, k * 12 + 3), v = dados[k] ?? ''; if (t < '010') campos.push({ t, v }); else { const p = v.split(US); campos.push({ t, i1: p[0][0] || ' ', i2: p[0][1] || ' ', s: p.slice(1).map(x => [x[0], x.slice(1)]) }); } }
  return { leader: iso.slice(0, 24), campos };
}
const marcLer = texto => texto.split(GS).filter(x => x.trim().length > 24).map(marcRegistro).filter(Boolean);
function marcEscrever(registros) {                                                    // -> Uint8Array ISO 2709 (UTF-8)
  const partes = [];
  for (const r of registros) {
    let dir = '', pos = 0; const dados = [];
    for (const c of r.campos) { const v = c.v !== undefined ? c.v : (c.i1 || ' ') + (c.i2 || ' ') + c.s.map(([k, x]) => US + k + x).join(''), b = bytes(v + RS); dir += c.t.padEnd(3, '0') + String(b.length).padStart(4, '0') + String(pos).padStart(5, '0'); pos += b.length; dados.push(b); }
    const base = 24 + dir.length + 1, tam = base + pos + 1, lider = String(tam).padStart(5, '0') + 'nam a22' + String(base).padStart(5, '0') + ' a 4500', corpo = new Uint8Array(tam);
    let o = 0; [bytes(lider.slice(0, 24) + dir + RS), ...dados, bytes(GS)].forEach(x => { corpo.set(x, o); o += x.length; }); partes.push(corpo);
  }
  const out = new Uint8Array(partes.reduce((s, x) => s + x.length, 0)); let o = 0; partes.forEach(x => { out.set(x, o); o += x.length; }); return out;
}
function marcXmlLer(t) {
  return [...t.matchAll(/<(?:\w+:)?record\b[^>]*>([\s\S]*?)<\/(?:\w+:)?record>/g)].map(m => { const b = m[1], campos = [];
    const lider = /<(?:\w+:)?leader>([\s\S]*?)<\/(?:\w+:)?leader>/.exec(b)?.[1] || ''.padEnd(24);
    for (const x of b.matchAll(/<(?:\w+:)?(controlfield|datafield)\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?\1>/g)) { const tag = /tag="(\d{3})"/.exec(x[2])?.[1]; if (!tag) continue;
      if (x[1] === 'controlfield') campos.push({ t: tag, v: xmlUnesc(x[3]) }); else campos.push({ t: tag, i1: /ind1="(.?)"/.exec(x[2])?.[1] || ' ', i2: /ind2="(.?)"/.exec(x[2])?.[1] || ' ', s: [...x[3].matchAll(/<(?:\w+:)?subfield\b[^>]*code="(.)"[^>]*>([\s\S]*?)<\/(?:\w+:)?subfield>/g)].map(s => [s[1], xmlUnesc(s[2])]) }); }
    return { leader: lider, campos }; });
}
const marcXmlEscrever = regs => `<?xml version="1.0" encoding="UTF-8"?>\n<collection xmlns="http://www.loc.gov/MARC21/slim">\n${regs.map(r => `<record><leader>${xmlEsc(r.leader || '00000nam a2200000 a 4500')}</leader>${r.campos.map(c => c.v !== undefined ? `<controlfield tag="${c.t}">${xmlEsc(c.v)}</controlfield>` : `<datafield tag="${c.t}" ind1="${xmlEsc(c.i1 || ' ')}" ind2="${xmlEsc(c.i2 || ' ')}">${c.s.map(([k, v]) => `<subfield code="${k}">${xmlEsc(v)}</subfield>`).join('')}</datafield>`).join('')}</record>`).join('\n')}\n</collection>`;
const sub = (r, tag, cod) => { for (const c of r.campos) if (c.t === tag && c.s) { const s = c.s.find(x => x[0] === cod); if (s && s[1].trim()) return s[1].trim(); } return ''; };
const subs = (r, tag, cod) => r.campos.filter(c => c.t === tag && c.s).flatMap(c => c.s.filter(x => x[0] === cod).map(x => x[1].trim())).filter(Boolean);
const isbd = s => String(s || '').replace(/[\s\/:;,=]+$/g, '').replace(/^\[|\]$/g, m => '').trim();
const IDIOMAS = { p: 'po', po: 'po', por: 'po', pt: 'po', en: 'en', eng: 'en', es: 'es', spa: 'es', fr: 'fr', fre: 'fr', fra: 'fr', it: 'it', ita: 'it', de: 'de', ger: 'de', deu: 'de', la: 'la', lat: 'la', ja: 'ja', jpn: 'ja' };
const TIPOS = { book: 'Livros', pamphlet: 'Folhetos', manuscript: 'Manuscritos', periodic: 'Periódicos', articles: 'Artigos', thesis: 'Teses e TCC', map: 'Mapas', cd: 'CDs', dvd: 'DVDs', video: 'Vídeos', audio: 'Áudios', sheet_music: 'Partituras', newspaper: 'Jornais' };
function marcParaAcervo(r, material) {
  const pag = sub(r, '300', 'a'), idi = (sub(r, '041', 'a') || (/^.{35}(\w{3})/.exec(r.campos.find(c => c.t === '008')?.v || '')?.[1] || '')).toLowerCase(), ass = [...subs(r, '650', 'a'), ...subs(r, '651', 'a'), ...subs(r, '653', 'a')];
  const cdd = sub(r, '090', 'a') || sub(r, '082', 'a'), cut = sub(r, '090', 'b') || sub(r, '082', 'b');
  return { tipo_material: TIPOS[material] || 'Livros', isbn: sub(r, '020', 'a') || null, issn: sub(r, '022', 'a') || null, fonte_catalogacao: sub(r, '040', 'a') || null, codigo_idioma: IDIOMAS[idi.slice(0, 3)] || IDIOMAS[idi.slice(0, 2)] || (idi ? idi.slice(0, 2) : 'po'),
    classificacao_cdd: cdd || null, codigo_autor_cutter: cut || null, nome_pessoal: isbd(sub(r, '100', 'a')) || null, autor_entidade: isbd(sub(r, '110', 'a') || sub(r, '111', 'a')) || null,
    titulo_principal: isbd(sub(r, '245', 'a') || sub(r, '240', 'a') || sub(r, '130', 'a') || sub(r, '246', 'a')) || 'Sem título', subtitulo: isbd(sub(r, '245', 'b')) || null, responsabilidade: isbd(sub(r, '245', 'c')) || null, edicao: isbd(sub(r, '250', 'a')) || null,
    local_publicacao: isbd(sub(r, '260', 'a') || sub(r, '264', 'a')) || null, editora: isbd(sub(r, '260', 'b') || sub(r, '264', 'b')) || null, data_publicacao: isbd(sub(r, '260', 'c') || sub(r, '264', 'c')).replace(/^\[|\]$/g, '') || null,
    descricao_fisica: [pag, sub(r, '300', 'b'), sub(r, '300', 'c')].filter(Boolean).join(' ') || null, numero_paginas: parseInt(/\d+/.exec(pag)?.[0], 10) || null, dimensoes: sub(r, '300', 'c') || null,
    indicacao_serie: isbd(sub(r, '490', 'a') || sub(r, '830', 'a')) || null, notas_gerais: subs(r, '500', 'a').join(' | ') || null, nota_bibliografia: sub(r, '504', 'a') || null, nota_conteudo: sub(r, '505', 'a') || null, nota_tese: sub(r, '502', 'a') || null, notas_resumo: sub(r, '520', 'a') || null,
    assunto: [...new Set(ass)].join('; ') || null, entrada_secundaria_pessoal: subs(r, '700', 'a').join('; ') || null, entrada_secundaria_entidade: subs(r, '710', 'a').join('; ') || null, link_eletronico: sub(r, '856', 'u') || null };
}
function acervoParaMarc(l) {
  const c = [], F = (t, s, i1 = ' ', i2 = ' ') => { s = s.filter(x => x[1] !== null && x[1] !== undefined && String(x[1]).trim() !== ''); if (s.length) c.push({ t, i1, i2, s: s.map(x => [x[0], String(x[1])]) }); };
  c.push({ t: '001', v: String(l.id ?? '').padStart(7, '0') }); F('020', [['a', l.isbn]]); F('022', [['a', l.issn]]); F('040', [['a', l.fonte_catalogacao]]); F('041', [['a', l.codigo_idioma]]);
  F('090', [['a', l.classificacao_cdd], ['b', l.codigo_autor_cutter]]); F('100', [['a', l.nome_pessoal]], '1'); F('110', [['a', l.autor_entidade]], '2'); F('245', [['a', l.titulo_principal], ['b', l.subtitulo], ['c', l.responsabilidade]], '1', '0');
  F('250', [['a', l.edicao]]); F('260', [['a', l.local_publicacao], ['b', l.editora], ['c', l.data_publicacao]]); F('300', [['a', l.descricao_fisica || (l.numero_paginas ? l.numero_paginas + ' p.' : '')]]); F('490', [['a', l.indicacao_serie]]);
  F('500', [['a', l.notas_gerais]]); F('502', [['a', l.nota_tese]]); F('504', [['a', l.nota_bibliografia]]); F('505', [['a', l.nota_conteudo]]); F('520', [['a', l.notas_resumo]]);
  String(l.assunto || '').split(/\s*;\s*/).filter(Boolean).forEach(a => F('650', [['a', a]], ' ', '4')); String(l.entrada_secundaria_pessoal || '').split(/\s*;\s*/).filter(Boolean).forEach(a => F('700', [['a', a]], '1'));
  F('710', [['a', l.entrada_secundaria_entidade]], '2'); F('856', [['u', l.link_eletronico]], '4', '0'); F('949', [['a', l.numero_tombo], ['d', l.data_aquisicao]]);
  return { leader: '00000nam a2200000 a 4500', campos: c };
}

// ---------- Dump PostgreSQL (COPY ... FROM stdin) ----------
const copiaTexto = s => s === '\\N' ? null : s.indexOf('\\') < 0 ? s : s.replace(/\\(\\|n|t|r|b|f|v|[0-7]{1,3})/g, (m, e) => ({ '\\': '\\', n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v' }[e] ?? String.fromCharCode(parseInt(e, 8))));
function pgLer(texto, tabelas) {
  const out = {}; let p = 0;
  while ((p = texto.indexOf('\nCOPY ', p)) >= 0) {
    const fimL = texto.indexOf('\n', p + 1), m = /^COPY (?:\w+\.)?(\w+) \(([^)]*)\) FROM stdin;/.exec(texto.slice(p + 1, fimL)); let fim = texto.indexOf('\n\\.\n', fimL); if (fim < 0) fim = texto.length;
    if (m && (!tabelas || tabelas.includes(m[1]))) { const cols = m[2].split(',').map(c => c.trim()); out[m[1]] = { cols, linhas: texto.slice(fimL + 1, fim).split('\n').filter(l => l !== '').map(l => { const v = l.split('\t'), o = {}; cols.forEach((c, i) => o[c] = v[i] === undefined ? null : copiaTexto(v[i])); return o; }) }; }
    p = fim;
  }
  return out;
}

// ---------- Biblivre -> Venous ----------
const dataBR = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : null; }, dataISO = s => { const m = /^(\d{4}-\d{2}-\d{2})/.exec(s || ''); return m ? m[1] : null; };
const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e || '');
async function lerBiblivre(arquivos) {                                                // arquivos: Map nome->{ler()} (b5bz) ; devolve tabelas necessárias
  const nomes = [...arquivos.keys()], data = nomes.filter(n => /(^|\/)(single|\w+)\.data\.b5b$/.test(n) && !/^global\./.test(n.split('/').pop())), meta = arquivos.has('backup.meta') ? JSON.parse(decodificar(await arquivos.get('backup.meta').ler())) : null;
  const tab = {}; for (const n of (data.length ? data : nomes.filter(n => /\.b5b$/.test(n)))) Object.assign(tab, pgLer(decodificar(await arquivos.get(n).ler()), ['biblio_records', 'biblio_holdings', 'users', 'users_values', 'users_types', 'lendings', 'reservations']));
  return { meta, tab };
}
function biblivreParaVenous(tab, o) {
  o = { agrupar: true, historico: true, inativos: false, ...(o || {}) }; const hoje = new Date().toISOString().slice(0, 10), t = n => tab[n]?.linhas || [];
  const recs = t('biblio_records'), hold = t('biblio_holdings'), porRec = {}; hold.forEach(h => (porRec[h.record_id] ||= []).push(h));
  const acervo = [], refPorRecord = {}, refPorHolding = {};
  for (const r of recs) {
    const marc = marcRegistro(r.iso2709); if (!marc) continue; const base = marcParaAcervo(marc, r.material), hs = (porRec[r.id] || []).sort((a, b) => a.id - b.id);
    const comum = { ...base, classificacao_geral: 'Geral', condicao_capa: 'Bom', em_lixeira: false, data_reg: dataISO(r.created), catalogador: 'Importado do Biblivre' };
    const ex = h => { const m = marcRegistro(h.iso2709); return { aq: m ? sub(m, '949', 'd') : '', local: m ? sub(m, '090', 'd') : '' }; };
    if (o.agrupar || !hs.length) {
      const tombos = hs.map(h => h.accession_number).filter(Boolean), a = { ...comum, numero_tombo: tombos[0] || String(r.id).padStart(7, '0'), exemplares: Math.max(1, hs.length), data_aquisicao: (hs[0] && ex(hs[0]).aq) || dataBR(r.created), origem_id: `biblivre:rec:${r.id}` };
      if (tombos.length > 1) a.notas_gerais = [a.notas_gerais, 'Tombos dos exemplares: ' + tombos.join('; ')].filter(Boolean).join(' | ');
      acervo.push(a); refPorRecord[r.id] = a; hs.forEach(h => refPorHolding[h.id] = a);
    } else hs.forEach(h => { const a = { ...comum, numero_tombo: h.accession_number, exemplares: 1, data_aquisicao: ex(h).aq || dataBR(h.created), origem_id: `biblivre:hold:${h.id}` }; acervo.push(a); refPorHolding[h.id] = a; refPorRecord[r.id] ||= a; });
  }
  // usuários
  const vals = {}; t('users_values').forEach(v => { if (v.value) (vals[v.user_id] ||= {})[v.key] = v.value; }); const usados = new Set(), emails = new Set(), usuarios = [], porId = {}, credenciais = [], ignoradosUsuarios = [];
  const senha = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), x => 'abcdefghjkmnpqrstuvwxyz23456789'[x % 31]).join('');
  for (const u of t('users')) {
    if (!o.inativos && u.status && u.status !== 'active') { ignoradosUsuarios.push(u); continue; }
    const v = vals[u.id] || {}, partes = slug(u.name) ? String(u.name).trim().split(/\s+/) : ['usuario'], b = `${slug(partes[0])}.${slug(partes[partes.length - 1])}`.replace(/\.$/, '') || 'usuario'; let login = b; if (usados.has(login)) login = `${b}.${u.id}`; usados.add(login);
    let email = String(v.email || '').trim().toLowerCase(); if (!emailOk(email) || emails.has(email) || /^123@|^m@m$/.test(email)) email = `${login}@sem-email.local`; emails.add(email);
    const pw = senha(), row = { nome: u.name, usuario: login, email, telefone: v.phone_cel || v.phone_home || v.phone_work || null, senha: pw, cargo: 'usuario', presencial_validado: true, origem_id: `biblivre:user:${u.id}` };
    usuarios.push(row); porId[u.id] = row; credenciais.push({ nome: u.name, usuario: login, senha: pw, email: emailOk(v.email) ? v.email : '' });
  }
  // empréstimos (renovações viram um único empréstimo)
  const lend = t('lendings'), prox = {}; lend.forEach(l => { if (l.previous_lending_id) prox[l.previous_lending_id] = l; }); const emprestimos = [];
  for (const raiz of lend.filter(l => !l.previous_lending_id)) {
    let ult = raiz, n = 0; while (prox[ult.id] && n++ < 200) ult = prox[ult.id]; const livro = refPorHolding[raiz.holding_id], usr = porId[raiz.user_id], ativo = !ult.return_date; if (!livro || !usr) continue; if (!ativo && !o.historico) continue;
    emprestimos.push({ _livro: livro, _usuario: usr, data_emprestimo: new Date(String(raiz.created).replace(' ', 'T') + 'Z').toISOString(), data_devolucao_prevista: dataISO(ult.expected_return_date), status: ativo ? 'Ativo' : 'Devolvido' });
  }
  const reservas = t('reservations').map(r => ({ _livro: refPorRecord[r.record_id], _usuario: porId[r.user_id], data_reserva: new Date(String(r.created).replace(' ', 'T') + 'Z').toISOString(), status: dataISO(r.expires) >= hoje ? 'Pendente' : 'Cancelada' })).filter(r => r._livro && r._usuario);
  return { acervo, usuarios, emprestimos, reservas, credenciais, ignoradosUsuarios: ignoradosUsuarios.length, exemplaresTotal: hold.length };
}

// ---------- Planilhas (CSV/XLSX) -> campos do Venous ----------
const CAMPOS = { acervo: [['titulo_principal', 'Título', ['titulo', 'title', 'obra', 'nomedolivro', 'tituloprincipal']], ['subtitulo', 'Subtítulo', ['subtitle', 'subtitulo']], ['nome_pessoal', 'Autor', ['autor', 'autores', 'author', 'escritor', 'autorpessoal']], ['autor_entidade', 'Autor (entidade)', ['entidade', 'instituicao', 'autorentidade']], ['editora', 'Editora', ['editora', 'publisher', 'editor']], ['local_publicacao', 'Local de publicação', ['local', 'cidade', 'localdepublicacao']], ['data_publicacao', 'Ano de publicação', ['ano', 'anopublicacao', 'datapublicacao', 'year', 'data', 'anodepublicacao']], ['edicao', 'Edição', ['edicao', 'edition']], ['isbn', 'ISBN', ['isbn', 'isbn10', 'isbn13']], ['issn', 'ISSN', ['issn']], ['classificacao_cdd', 'CDD / CDU', ['cdd', 'cdu', 'classificacao', 'cddcdu', 'classificacaocdd']], ['codigo_autor_cutter', 'Cutter', ['cutter', 'codigodoautor', 'codigoautor']], ['numero_tombo', 'Tombo / Registro', ['tombo', 'registro', 'numerodetombo', 'numerotombo', 'accession', 'patrimonio', 'tombamento', 'nderegistro', 'numeroderegistro']], ['exemplares', 'Exemplares', ['exemplares', 'qtd', 'quantidade', 'copies', 'nexemplares']], ['assunto', 'Assunto', ['assunto', 'assuntos', 'palavraschave', 'palavrachave', 'subject', 'keywords']], ['codigo_idioma', 'Idioma', ['idioma', 'lingua', 'language']], ['tipo_material', 'Tipo de material', ['tipo', 'tipodematerial', 'material', 'tipomaterial']], ['numero_paginas', 'Páginas', ['paginas', 'pags', 'npaginas', 'pages', 'numerodepaginas']], ['descricao_fisica', 'Descrição física', ['descricaofisica', 'descricao']], ['notas_gerais', 'Notas', ['notas', 'observacoes', 'obs', 'observacao', 'notasgerais']], ['capa_url', 'URL da capa', ['capa', 'imagem', 'urldacapa', 'capaurl']], ['data_aquisicao', 'Data de aquisição', ['aquisicao', 'dataaquisicao', 'datadeaquisicao']], ['tipo_aquisicao', 'Forma de aquisição', ['formadeaquisicao', 'tipoaquisicao', 'origem']], ['preco', 'Preço', ['preco', 'valor']]],
  usuarios: [['nome', 'Nome', ['nome', 'name', 'nomecompleto', 'leitor', 'usuario', 'aluno']], ['email', 'E-mail', ['email', 'emailaddress', 'correio']], ['telefone', 'Telefone', ['telefone', 'celular', 'fone', 'phone', 'whatsapp']], ['usuario', 'Login (opcional)', ['login', 'username', 'nomedeusuario']], ['cargo', 'Cargo (opcional)', ['cargo', 'perfil', 'tipo']]] };
function mapearColunas(cabecalho, destino) {
  const lista = CAMPOS[destino], usados = new Set(), mapa = cabecalho.map(h => { const n = slug(h); const hit = lista.find(([c, , sin]) => !usados.has(c) && (n === slug(c) || sin.includes(n))); if (hit) usados.add(hit[0]); return hit ? hit[0] : ''; }); return mapa;
}
function linhasParaObjetos(linhas, mapa, destino) {
  const out = []; for (const r of linhas) { const o = {}; mapa.forEach((c, i) => { if (c && r[i] !== undefined && String(r[i]).trim() !== '') o[c] = String(r[i]).trim(); }); if (!Object.keys(o).length) continue;
    if (destino === 'acervo') { if (!o.titulo_principal) continue; o.exemplares = parseInt(o.exemplares, 10) || 1; if (o.numero_paginas) o.numero_paginas = parseInt(o.numero_paginas, 10) || null; o.tipo_material ||= 'Livros'; o.codigo_idioma = IDIOMAS[slug(o.codigo_idioma || '').slice(0, 3)] || (o.codigo_idioma ? slug(o.codigo_idioma).slice(0, 2) : 'po'); o.classificacao_geral = 'Geral'; o.condicao_capa = 'Bom'; o.em_lixeira = false; o.catalogador = 'Importado de planilha'; o.data_reg = new Date().toISOString().slice(0, 10); }
    else { if (!o.nome) continue; o.cargo = ['usuario', 'estagiario', 'bibliotecario'].includes(slug(o.cargo)) ? slug(o.cargo) : 'usuario'; o.presencial_validado = true; }
    out.push(o); } return out;
}

// ---------- Detecção do formato ----------
async function detectar(nome, buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf), ext = (nome.split('.').pop() || '').toLowerCase(), zip = u8[0] === 0x50 && u8[1] === 0x4B;
  if (zip) {
    const z = await lerZip(u8), ks = [...z.keys()];
    if (ks.includes('backup.meta') || ks.some(k => /\.data\.b5b$/.test(k))) return { tipo: 'biblivre', zip: z };
    if (ks.includes('[Content_Types].xml') && ks.some(k => k.startsWith('xl/'))) return { tipo: 'xlsx', planilhas: await xlsxLer(u8) };
    const util = ks.filter(k => /\.(json|csv|tsv|txt|mrc|iso|marc|xml|xlsx|sql|b5b)$/i.test(k) && !/(^|\/)\./.test(k)); if (util.length === 1) return detectar(util[0].split('/').pop(), await z.get(util[0]).ler());
    if (util.length > 1 && util.every(k => /\.csv$/i.test(k))) return { tipo: 'csvzip', zip: z, arquivos: util };
    throw new Error('ZIP sem arquivos reconhecidos.');
  }
  const txt = decodificar(u8);
  if (/^--\s*\n-- PostgreSQL database dump/.test(txt.slice(0, 200)) || /\nCOPY \w+ \(/.test(txt.slice(0, 20000)) || /\.(b5b|sql)$/.test(ext)) return { tipo: 'pgdump', texto: txt };
  if (ext === 'json' || /^\s*[\[{]/.test(txt)) { try { const j = JSON.parse(txt); return j && (j.formato === 'railda-backup' || j.formato === 'venous-backup') ? { tipo: 'venous', backup: j } : { tipo: 'tabela', linhas: objetosParaLinhas(Array.isArray(j) ? j : Object.values(j).find(Array.isArray) || []) }; } catch (_) {} }
  if (/<(\w+:)?record\b/.test(txt.slice(0, 5000)) && /datafield/.test(txt)) return { tipo: 'marcxml', registros: marcXmlLer(txt) };
  if (/^\d{5}[a-z ]/i.test(txt) && txt.includes(RS) || ['mrc', 'iso', 'marc'].includes(ext)) return { tipo: 'marc', registros: marcLer(txt) };
  return { tipo: 'tabela', linhas: csvParse(txt).linhas, delimitador: csvParse(txt).delimitador };
}

const API = { decodificar, bytes, lerZip, criarZip, csvParse, csvTexto, objetosParaLinhas, xlsxLer, xlsxCriar, marcLer, marcRegistro, marcEscrever, marcXmlLer, marcXmlEscrever, marcParaAcervo, acervoParaMarc, pgLer, lerBiblivre, biblivreParaVenous, CAMPOS, mapearColunas, linhasParaObjetos, detectar, slug, crc32, TIPOS };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else globalThis.VenousIO = API;
})();
