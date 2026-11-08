// Venous • Minha Área: feed social, favoritos, reservas, abas, toasts e confirmação
(() => {
const $ = id => document.getElementById(id), esc = v => escaparHTML(v);
const TIPOS = { geral: ['fa-message', 'Geral'], resenha: ['fa-star', 'Resenha'], citacao: ['fa-quote-left', 'Citação'], recomendo: ['fa-thumbs-up', 'Recomendo'], lendo: ['fa-book-open', 'Lendo agora'] };
const LK = 'venous_feed_local', eu = () => usuarioAtual || {}, logado = () => eu().id && eu().nome !== 'Visitante (Público)';
const livro = id => (acervoCompleto || []).find(l => +l.id === +id);
const tit = l => l.titulo_principal || l.tituloPrincipal || 'Sem título', capa = l => l.capa_url || l.capaUrl || '', aut = l => l.nome_pessoal || l.responsabilidade || '';
const cv = l => capa(l) ? `<img class="cv" src="${esc(capa(l))}" alt="" onerror="this.style.visibility='hidden'">` : '<div class="cv"><i class="fa-solid fa-book"></i></div>';
const OKURL = u => /^(https:\/\/|data:image\/)/.test(u || ''), MODERAR_MIDIA = true, GENEROS = ['Romance', 'Fantasia', 'Ficção científica', 'Terror', 'Mistério', 'Biografia', 'História', 'Poesia', 'Autoajuda', 'Infantil', 'HQ/Mangá', 'Técnico'];
let PERFIS = {}, perfilLocal = false, fotoTmp = null, gen = [];
const avIn = (n, foto) => foto && OKURL(foto) ? `<img src="${esc(foto)}" alt="">` : esc((n || '?')[0].toUpperCase());
const av = (n, id, semLink, foto) => `<div class="av"${semLink ? ' style="width:88px;height:88px;font-size:2rem;margin:auto;--h:' + (Number(id) * 47) % 360 + '"' : ` data-act="perfil" data-u="${Number(id)}" style="--h:${(Number(id) * 47) % 360}"`}>${avIn(n, foto === undefined ? PERFIS[id]?.foto : foto)}</div>`;
const livrosDe = p => p.livros?.length ? p.livros : [...(p.livro_id ? [{ id: p.livro_id }] : []), ...(p.livro_externo_titulo ? [{ ext: p.livro_externo_titulo }] : [])];
const blocoLivros = (p, acoes) => livrosDe(p).map(x => { const l = x.id ? livro(x.id) : null; return `<div class="post-book">${l ? cv(l) : '<div class="cv"><i class="fa-solid fa-book"></i></div>'}<div class="i"><b>${esc(l ? tit(l) : x.ext || 'Livro')}</b><small>${esc(l ? aut(l) : 'Livro externo')}</small></div>${acoes && l ? `<button class="btn btn-outline btn-sm" data-act="fav" data-l="${l.id}"><i class="fa-solid fa-heart"></i></button><button class="btn btn-primary btn-sm" data-act="res" data-l="${l.id}">Reservar</button>` : ''}</div>`; }).join('');
const blocoMidia = p => { const m = (p.midias || []).filter(OKURL); return m.length ? `<div class="midias${m.length === 1 ? ' u' : ''}">${m.map(u => `<img data-act="zoom" src="${esc(u)}" alt="Mídia do post" loading="lazy" onerror="this.style.display='none'">`).join('')}</div>` : ''; };
const lerImg = (f, max, q, quad) => new Promise((ok, no) => {
  if (f.type === 'image/gif' && !quad) { if (f.size > 1.5e6) return no('GIF acima de 1,5 MB.'); const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no('Falha ao ler o arquivo.'); return r.readAsDataURL(f); }
  const u = URL.createObjectURL(f), im = new Image(); im.onerror = () => no('Imagem inválida.');
  im.onload = () => { const c = document.createElement('canvas'), x = c.getContext('2d'); if (quad) { const m = Math.min(im.width, im.height); c.width = c.height = max; x.drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, 0, 0, max, max); } else { const k = Math.min(1, max / Math.max(im.width, im.height)); c.width = im.width * k; c.height = im.height * k; x.drawImage(im, 0, 0, c.width, c.height); } URL.revokeObjectURL(u); ok(c.toDataURL('image/jpeg', q)); };
  im.src = u;
});
async function addArquivos(fs) {
  for (const f of [...fs].filter(f => f.type.startsWith('image/'))) { if (midias.length >= 4) { toast('Máximo de 4 mídias por post.'); break; } try { midias.push(await lerImg(f, 1280, .8)); } catch (e) { toast(String(e), 'erro'); } }
  renderComp();
}
async function carregarPerfis() {
  if (!supabaseClient) perfilLocal = true;
  if (!perfilLocal) { const { data, error } = await supabaseClient.from('perfis').select('*'); if (!error) { PERFIS = Object.fromEntries((data || []).map(r => [r.usuario_id, r])); return; } perfilLocal = true; }
  try { PERFIS = JSON.parse(localStorage.getItem('venous_perfis')) || {}; } catch (_) { PERFIS = {}; }
}
async function gravarPerfil(uid, d) {
  const r = { ...(PERFIS[uid] || {}), ...d, usuario_id: uid }; PERFIS[uid] = r;
  if (perfilLocal) { try { localStorage.setItem('venous_perfis', JSON.stringify(PERFIS)); return true; } catch (_) { toast('Armazenamento local cheio.', 'erro'); return false; } }
  const { error } = await supabaseClient.from('perfis').upsert([{ ...r, updated_at: new Date().toISOString() }], { onConflict: 'usuario_id' });
  if (error) { toast('Erro ao salvar perfil: ' + error.message); return false; } return true;
}
function cardPerfil(uid, ov) {
  const pf = { ...(PERFIS[uid] || {}), ...(ov || {}) }, u = (listaUsuarios || []).find(x => +x.id === +uid) || (+uid === +eu().id ? eu() : {}), nome = u.nome || posts.find(x => +x.usuario_id === +uid)?.nome_usuario || 'Usuário';
  const n = posts.filter(x => +x.usuario_id === +uid && (x.status || 'publicado') === 'publicado').length;
  return `<div class="pcard">${av(nome, uid, 1, pf.foto || null)}<h3>${esc(nome)}</h3><small class="muted">${esc((u.cargo || 'usuario').toUpperCase())}</small><p>${pf.bio ? esc(pf.bio) : '<span class="muted">Sem bio ainda.</span>'}</p><div class="flags" style="justify-content:center">${pf.cidade ? `<span class="pill"><i class="fa-solid fa-location-dot"></i> ${esc(pf.cidade)}</span>` : ''}${pf.livro_favorito ? `<span class="pill"><i class="fa-solid fa-book"></i> ${esc(pf.livro_favorito)}</span>` : ''}${(pf.generos || []).map(g => `<span class="pill">${esc(g)}</span>`).join('')}</div><small class="muted">${n} publicaç${n === 1 ? 'ão' : 'ões'}</small>${STAFF() && PERFIS[uid]?.foto && +uid !== +eu().id ? `<br><button class="btn btn-danger btn-sm" style="margin-top:10px" data-act="rmfoto" data-u="${uid}">Remover foto (moderação)</button>` : ''}</div>`;
}
const lerForm = () => ({ foto: fotoTmp, bio: $('pfBio').value.trim(), cidade: $('pfCidade').value.trim(), livro_favorito: $('pfLivro').value.trim(), generos: gen });
function pintarPerfil() {
  $('pfCnt').textContent = $('pfBio').value.length + '/200'; $('pfFoto').innerHTML = avIn(eu().nome, fotoTmp);
  $('pfGeneros').innerHTML = GENEROS.map(g => `<button type="button" class="chip${gen.includes(g) ? ' on' : ''}" data-gen="${g}">${g}</button>`).join('');
  $('pfPrev').innerHTML = cardPerfil(eu().id, lerForm());
  $('pfConta').innerHTML = `<b>${esc(eu().nome)}</b><br>${esc(eu().email || '')}<br>@${esc(eu().usuario || '')}`;
}
function renderPerfilForm() { const pf = PERFIS[eu().id] || {}; fotoTmp = pf.foto || null; gen = [...(pf.generos || [])]; $('pfBio').value = pf.bio || ''; $('pfCidade').value = pf.cidade || ''; $('pfLivro').value = pf.livro_favorito || ''; pintarPerfil(); }
let posts = [], local = !supabaseClient, tipo = 'geral', nota = 0, anexos = [], midias = [], limite = 20, lim = {};

function toast(m, t) { const d = document.createElement('div'); d.className = 'toast ' + (t || (/erro|falh/i.test(m) ? 'erro' : '')); d.textContent = m; $('toasts').appendChild(d); setTimeout(() => d.remove(), 3500); }
window.alert = m => toast(String(m));
window.confirmarAcao = (titulo, texto, rotulo = 'Confirmar') => new Promise(ok => {
  $('cfT').textContent = titulo; $('cfP').textContent = texto; $('cfYes').textContent = rotulo; $('modalConfirmar').classList.add('active');
  const fim = v => { $('modalConfirmar').classList.remove('active'); ok(v); };
  $('cfYes').onclick = () => fim(true); $('cfNo').onclick = () => fim(false);
});
const quando = t => { const s = (Date.now() - new Date(t)) / 1000; return s < 60 ? 'agora' : s < 3600 ? `há ${~~(s / 60)} min` : s < 86400 ? `há ${~~(s / 3600)} h` : new Date(t).toLocaleDateString('pt-BR'); };

// ---------- Moderação ----------
const STAFF = () => ['bibliotecario', 'estagiario'].includes((eu().cargo || '').toLowerCase());
const norm = t => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const BLOQ = /\b(porra|caralho|merda|puta|putaria|fdp|viado|buceta|cuzao|arrombad\w*|babaca|idiota|imbecil|retardad\w*|nazista|vagabund\w*|otario|desgraca\w*)\b/;
const suspeito = t => BLOQ.test(norm(t)) ? 'Linguagem ofensiva (filtro automático)' : /(https?:\/\/|www\.)/i.test(t) ? 'Contém link (possível spam)' : '';
const visivel = p => STAFF() ? p.status !== 'removido' : (p.status || 'publicado') === 'publicado' && (p.denuncias || []).length < 3 || +p.usuario_id === +eu().id;
const aviso = (p, meu) => meu && p.status === 'pendente' ? '<div class="aviso"><i class="fa-solid fa-hourglass-half"></i> Em análise pela moderação — só você vê este post por enquanto.</div>' : meu && p.status === 'removido' ? `<div class="aviso rem"><i class="fa-solid fa-ban"></i> Removido pela moderação: ${esc(p.motivo || 'conteúdo inapropriado')}.</div>` : '';
const MOTIVOS = ['Linguagem ofensiva', 'Spam ou links', 'Fora do tema', 'Desrespeito a outros usuários', 'Outro'];
function modCard(p) {
  const l = p.livro_id ? livro(p.livro_id) : null, d = (p.denuncias || []).length, rem = p.status === 'removido';
  return `<article class="post" data-id="${p.id}"><div class="post-h">${av(p.nome_usuario, p.usuario_id)}<div class="who"><b>${esc(p.nome_usuario)}</b><small>${quando(p.created_at)} • ${(TIPOS[p.tipo] || TIPOS.geral)[1]}</small></div>${rem ? '<span class="st Cancelada">Removido</span>' : ''}</div>
<div class="flags">${p.motivo && !rem ? `<span class="st Pendente"><i class="fa-solid fa-robot"></i> ${esc(p.motivo)}</span>` : ''}${d ? `<span class="st Cancelada"><i class="fa-solid fa-flag"></i> ${d} denúncia(s)</span>` : ''}</div>
<div class="post-t">${esc(p.texto)}</div>${blocoMidia(p)}${blocoLivros(p)}
<div class="acts">${rem ? `<small class="muted" style="flex:1">Motivo: ${esc(p.motivo || '-')} • por ${esc(p.moderado_por || '-')}</small><button class="btn btn-outline btn-sm" data-act="aprovar">Restaurar</button>` : `<select class="modmot">${MOTIVOS.map(m => `<option>${m}</option>`).join('')}</select><span style="flex:1"></span><button class="btn btn-success btn-sm" data-act="aprovar"><i class="fa-solid fa-check"></i> Aprovar</button><button class="btn btn-danger btn-sm" data-act="remover"><i class="fa-solid fa-ban"></i> Remover</button>`}</div></article>`;
}
function renderMod() {
  if (!$('tabMod')) return; $('tabMod').classList.toggle('hidden', !STAFF()); if (!STAFF()) return;
  const fila = posts.filter(p => p.status === 'pendente' || (p.status !== 'removido' && (p.denuncias || []).length)), n = fila.length;
  $('modBadge').textContent = n; $('modBadge').classList.toggle('hidden', !n);
  const v = $('modFiltro').value === 'removidos' ? posts.filter(p => p.status === 'removido') : fila;
  $('modLista').innerHTML = v.length ? v.map(modCard).join('') : '<div class="empty"><i class="fa-solid fa-shield-halved"></i>Nada para revisar. Tudo em ordem!</div>';
}

// ---------- Armazenamento do feed (Supabase; cai para localStorage se a tabela não existir) ----------
async function carregarFeed() {
  if (!supabaseClient) local = true;
  if (supabaseClient && !local) {
    const { data, error } = await supabaseClient.from('feed_posts').select('*').order('created_at', { ascending: false }).limit(50);
    if (!error) { posts = data || []; return; } local = true;
  }
  try { posts = JSON.parse(localStorage.getItem(LK)) || []; } catch (_) { posts = []; }
}
const salvarLocal = () => { try { localStorage.setItem(LK, JSON.stringify(posts)); } catch (_) {} };
async function atualizar(p) { if (local) return salvarLocal(); const { error } = await supabaseClient.from('feed_posts').update({ curtidas: p.curtidas, comentarios: p.comentarios, status: p.status, motivo: p.motivo, denuncias: p.denuncias, moderado_por: p.moderado_por }).eq('id', p.id); if (error) toast('Erro: ' + error.message); }
async function publicar() {
  const texto = $('compTxt').value.trim(); if ((!texto && !midias.length) || !logado()) return;
  const p = { usuario_id: eu().id, nome_usuario: eu().nome, tipo, texto, livro_id: anexos.find(a => a.id)?.id ?? null, livro_externo_titulo: anexos.find(a => a.externo)?.externo || null, livros: anexos.map(a => a.id ? { id: a.id } : { ext: a.externo }), midias, nota: tipo === 'resenha' && nota ? nota : null, curtidas: [], comentarios: [], denuncias: [], status: 'publicado', motivo: null };
  const susp = STAFF() ? '' : suspeito(texto) || (MODERAR_MIDIA && midias.length ? 'Contém foto/GIF (revisão prévia)' : ''); if (susp) { p.status = 'pendente'; p.motivo = susp; }
  if (local) { posts.unshift({ ...p, id: Date.now(), created_at: new Date().toISOString() }); salvarLocal(); }
  else { const { data, error } = await supabaseClient.from('feed_posts').insert([p]).select().single(); if (error) return toast('Erro ao publicar: ' + error.message); posts.unshift(data); }
  $('compTxt').value = ''; anexos = []; midias = []; nota = 0; tipo = 'geral'; fecharComp(); renderTudo(); toast(susp ? 'Enviado para análise da moderação antes de aparecer no feed.' : 'Publicado!');
}

// ---------- Compositor ----------
const fecharComp = () => { $('comp').classList.remove('open'); $('picker').classList.add('hidden'); renderComp(); };
function renderComp() {
  $('compTipos').innerHTML = Object.entries(TIPOS).map(([k, [i, n]]) => `<button class="chip${k === tipo ? ' on' : ''}" data-tipo="${k}"><i class="fa-solid ${i}"></i> ${n}</button>`).join('');
  $('compStars').classList.toggle('hidden', tipo !== 'resenha');
  $('compStars').innerHTML = [1, 2, 3, 4, 5].map(n => `<button data-nota="${n}" class="${n <= nota ? 'on' : ''}" aria-label="${n} estrelas">★</button>`).join('');
  $('compBook').innerHTML = anexos.map((a, i) => `<div class="post-book">${a.l ? cv(a.l) : '<div class="cv"><i class="fa-solid fa-book"></i></div>'}<div class="i"><b>${esc(a.l ? tit(a.l) : a.externo)}</b><small>${esc(a.l ? aut(a.l) : 'Livro externo')}</small></div><button class="act" data-act="desanexar" data-i="${i}" title="Remover"><i class="fa-solid fa-xmark"></i></button></div>`).join('');
  $('compMidia').innerHTML = midias.map((m, i) => `<div class="thumb"><img src="${esc(m)}" alt=""><button data-act="rmmidia" data-i="${i}" aria-label="Remover mídia">×</button></div>`).join('');
  const n = $('compTxt').value.length; $('compCnt').textContent = n + '/500'; $('btnPub').disabled = (!n && !midias.length) || !logado();
}
function renderPicker() {
  const q = $('pickQ').value.trim().toLowerCase(), favs = listaFavoritos.filter(f => +f.usuario_id === +eu().id).map(f => livro(f.livro_id)).filter(Boolean);
  const lista = q ? (acervoCompleto || []).filter(l => tit(l).toLowerCase().includes(q)).slice(0, 20) : favs;
  $('pickList').innerHTML = (q ? '' : '<small class="muted">Seus favoritos</small>') + lista.map(l => `<button class="pick${anexos.some(a => a.id === l.id) ? ' sel' : ''}" data-pick="${l.id}">${cv(l)}<span><b>${esc(tit(l))}</b><br><small class="muted">${esc(aut(l))}</small></span></button>`).join('') + (q ? `<button class="pick" data-ext="${esc($('pickQ').value.trim())}"><i class="fa-solid fa-plus"></i> Usar “${esc($('pickQ').value.trim())}” como livro externo</button>` : lista.length ? '' : '<small class="muted">Digite para buscar no acervo.</small>');
}

// ---------- Feed ----------
function cardPost(p) {
  const l = p.livro_id ? livro(p.livro_id) : null, meu = +p.usuario_id === +eu().id, curt = (p.curtidas || []).map(Number).includes(+eu().id), t = TIPOS[p.tipo] || TIPOS.geral, cm = p.comentarios || [];
  const ver = (lim[p.id] ?? 0) === 1, longo = p.texto.length > 300 && !ver;
  return `<article class="post ${esc(p.tipo)}${p.status === 'removido' ? ' removido' : ''}" data-id="${p.id}"><div class="post-h">${av(p.nome_usuario, p.usuario_id)}<div class="who"><b data-act="perfil" data-u="${Number(p.usuario_id)}" style="cursor:pointer">${esc(p.nome_usuario || 'Usuário')}${meu ? ' <small>(você)</small>' : ''}</b><small>${quando(p.created_at)}</small></div><span class="pill"><i class="fa-solid ${t[0]}"></i> ${t[1]}</span>${meu || STAFF() ? '<button class="act" data-act="del" title="Excluir post"><i class="fa-solid fa-trash"></i></button>' : '<button class="act" data-act="denunciar" title="Denunciar"><i class="fa-regular fa-flag"></i></button>'}</div>
${aviso(p, meu)}${p.nota ? `<div class="rate">${'★'.repeat(p.nota)}${'☆'.repeat(5 - p.nota)}</div>` : ''}
<div class="post-t">${esc(longo ? p.texto.slice(0, 300) + '…' : p.texto)}${p.texto.length > 300 ? ` <a href="#" data-act="mais" class="link" style="color:var(--link)">${ver ? 'ver menos' : 'ver mais'}</a>` : ''}</div>
${blocoMidia(p)}${blocoLivros(p, true)}
<div class="acts"><button class="act${curt ? ' on' : ''}" data-act="like"><i class="fa-${curt ? 'solid' : 'regular'} fa-heart"></i> ${(p.curtidas || []).length || ''} Curtir</button><button class="act" data-act="cmt"><i class="fa-regular fa-comment"></i> ${cm.length || ''} Comentar</button></div>
<div class="cmts hidden">${cm.map((c, i) => `<div class="cmt"><b>${esc(c.nome)}</b>${esc(c.texto)}${+c.uid === +eu().id ? ` <button class="act" data-act="delc" data-i="${i}" style="display:inline-flex;padding:2px 6px"><i class="fa-solid fa-xmark"></i></button>` : ''}</div>`).join('')}<div class="cmt-f"><input maxlength="300" placeholder="Escreva um comentário…"><button class="btn btn-primary btn-sm" data-act="send">Enviar</button></div></div></article>`;
}
function renderFeed() {
  const f = $('fFiltro').value, o = $('fOrdem').value; let v = posts.filter(visivel).filter(p => f === 'todos' || (f === 'meus' ? +p.usuario_id === +eu().id : p.tipo === f));
  if (o === 'populares') v = [...v].sort((a, b) => ((b.curtidas || []).length * 2 + (b.comentarios || []).length) - ((a.curtidas || []).length * 2 + (a.comentarios || []).length));
  $('feedLista').innerHTML = v.length ? v.slice(0, limite).map(cardPost).join('') + (v.length > limite ? '<button class="btn btn-outline" data-act="mais-posts" style="width:100%">Carregar mais</button>' : '') : '<div class="empty"><i class="fa-solid fa-feather"></i>Nenhuma publicação por aqui ainda.<br>Seja o primeiro a compartilhar uma leitura!</div>';
  $('feedModo').innerHTML = local ? '<i class="fa-solid fa-circle-info"></i> Modo local: posts visíveis só neste navegador. Execute <b>supabase_feed.sql</b> para ativar o feed compartilhado.' : '';
}

// ---------- Favoritos, reservas, resumo ----------
const meusFavs = () => listaFavoritos.filter(f => +f.usuario_id === +eu().id).map(f => livro(f.livro_id)).filter(Boolean);
const minhasRes = () => listaReservas.filter(r => +r.usuario_id === +eu().id);
function renderFavs() {
  const q = $('favQ').value.toLowerCase(), v = meusFavs().filter(l => tit(l).toLowerCase().includes(q));
  $('meusFavoritosContainer').innerHTML = v.length ? v.map(l => `<div class="fav">${cv(l)}<b>${esc(tit(l))}</b><small>${esc(aut(l))}</small><div class="btn-group"><button class="btn btn-primary btn-sm" data-act="res" data-l="${l.id}">Reservar</button><button class="btn btn-outline btn-sm" data-act="postar" data-l="${l.id}" title="Postar sobre"><i class="fa-solid fa-pen"></i></button><button class="btn btn-outline btn-sm" data-act="fav" data-l="${l.id}" title="Remover"><i class="fa-solid fa-trash"></i></button></div></div>`).join('') : `<div class="empty" style="grid-column:1/-1"><i class="fa-regular fa-heart"></i>Nenhum favorito${q ? ' encontrado' : ' ainda'}.<br><a href="index.html" style="color:var(--link)">Explorar o acervo</a></div>`;
}
function renderReservas() {
  const f = $('resFiltro').value, v = minhasRes().filter(r => !f || r.status === f);
  $('tbMinhasReservas').innerHTML = v.length ? v.map(r => { const l = livro(r.livro_id); return `<div class="rsv">${l ? cv(l) : '<div class="cv"></div>'}<div class="i"><b>${esc(l ? tit(l) : 'Livro removido')}</b><br><small class="muted">${r.data_reserva ? new Date(r.data_reserva).toLocaleDateString('pt-BR') : '-'}</small></div><span class="st ${esc(r.status)}">${esc(r.status)}</span>${r.status === 'Pendente' ? `<button class="btn btn-danger btn-sm" data-act="canc" data-r="${r.id}">Cancelar</button>` : ''}</div>`; }).join('') : '<div class="empty"><i class="fa-regular fa-bookmark"></i>Nenhuma reserva encontrada.</div>';
  const pend = minhasRes().filter(r => r.status === 'Pendente');
  $('sideRes').innerHTML = pend.slice(0, 4).map(r => `<div class="mini"><span class="i">${esc(livro(r.livro_id) ? tit(livro(r.livro_id)) : 'Livro')}</span><span class="st Pendente">Pendente</span></div>`).join('') || '<small class="muted">Sem reservas pendentes.</small>';
  $('sideFav').innerHTML = meusFavs().slice(0, 4).map(l => `<div class="mini">${cv(l)}<span class="i">${esc(tit(l))}</span></div>`).join('') || '<small class="muted">Nenhum favorito ainda.</small>';
}
function renderHero() {
  const u = eu(); $('heroAv').innerHTML = $('compAv').innerHTML = avIn(u.nome, PERFIS[u.id]?.foto); $('heroNome').textContent = u.nome || 'Minha Área';
  $('heroSub').textContent = `${(u.cargo || 'usuario').toUpperCase()}${u.email ? ' • ' + u.email : ''}`;
  $('stPosts').textContent = posts.filter(p => +p.usuario_id === +u.id).length; $('stFavs').textContent = meusFavs().length; $('stRes').textContent = minhasRes().filter(r => r.status === 'Pendente').length; $('stChats').textContent = (typeof listaChatsUsuario !== 'undefined' ? listaChatsUsuario.length : 0);
}
function renderTudo() { renderMod(); renderHero(); renderFeed(); renderFavs(); renderReservas(); renderComp(); }

// ---------- Abas ----------
function aba(n) {
  if (!['feed', 'favoritos', 'reservas', 'chat', 'perfil', ...(STAFF() ? ['moderacao'] : [])].includes(n)) n = 'feed';
  document.querySelectorAll('.pane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + n));
  document.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === n));
  if (n === 'perfil') renderPerfilForm();
  history.replaceState(null, '', '#' + n);
}
window.MinhaArea = { render: renderTudo, aba, onChatBadge: n => { const b = $('tabBadge'); if (b) { b.textContent = n; b.classList.toggle('hidden', !n); } } };
window.carregarPerfilUsuario = () => { if (logado()) renderTudo(); };

// ---------- Eventos ----------
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-tab],[data-go],[data-gen],[data-tipo],[data-nota],[data-pick],[data-ext],[data-act]'); if (!t) return;
  if (t.dataset.tab || t.dataset.go) { e.preventDefault(); return aba(t.dataset.tab || t.dataset.go); }
  if (t.dataset.tipo) { tipo = t.dataset.tipo; return renderComp(); }
  if (t.dataset.nota) { nota = nota === +t.dataset.nota ? 0 : +t.dataset.nota; return renderComp(); }
  if (t.dataset.gen) { const g = t.dataset.gen; gen = gen.includes(g) ? gen.filter(x => x !== g) : gen.length < 6 ? [...gen, g] : (toast('Escolha até 6 gêneros.'), gen); return pintarPerfil(); }
  if (t.dataset.pick) { const id = +t.dataset.pick, i = anexos.findIndex(a => a.id === id); if (i >= 0) anexos.splice(i, 1); else if (anexos.length < 5) anexos.push({ id, l: livro(id) }); else toast('Máximo de 5 livros por post.'); renderPicker(); return renderComp(); }
  if (t.dataset.ext) { if (anexos.length < 5) anexos.push({ externo: t.dataset.ext }); $('pickQ').value = ''; renderPicker(); return renderComp(); }
  const a = t.dataset.act, card = t.closest('.post'), p = card && posts.find(x => String(x.id) === card.dataset.id), L = t.dataset.l;
  if (a === 'desanexar') { anexos.splice(+t.dataset.i, 1); renderPicker(); renderComp(); }
  else if (a === 'rmmidia') { midias.splice(+t.dataset.i, 1); renderComp(); }
  else if (a === 'zoom') { $('imgGrande').src = t.src; $('modalImg').classList.add('active'); }
  else if (a === 'perfil') { $('perfilConteudo').innerHTML = cardPerfil(t.dataset.u); $('modalPerfil').classList.add('active'); }
  else if (a === 'rmfoto' && STAFF()) { if (await gravarPerfil(+t.dataset.u, { foto: null })) { $('perfilConteudo').innerHTML = cardPerfil(t.dataset.u); renderTudo(); toast('Foto removida pela moderação'); } }
  else if (a === 'mais-posts') { limite += 20; renderFeed(); }
  else if (a === 'mais') { e.preventDefault(); lim[p.id] = lim[p.id] ? 0 : 1; renderFeed(); }
  else if (a === 'cmt') card.querySelector('.cmts').classList.toggle('hidden');
  else if (a === 'like') { const s = new Set((p.curtidas || []).map(Number)); s.has(+eu().id) ? s.delete(+eu().id) : s.add(+eu().id); p.curtidas = [...s]; renderFeed(); await atualizar(p); }
  else if (a === 'send') { const i = card.querySelector('.cmt-f input'), v = i.value.trim(); if (!v) return; if (!STAFF() && suspeito(v)) return toast('Comentário bloqueado: remova linguagem ofensiva ou links.', 'erro'); (p.comentarios ||= []).push({ uid: eu().id, nome: eu().nome, texto: v, t: new Date().toISOString() }); renderFeed(); card.dataset.id && document.querySelector(`[data-id="${p.id}"] .cmts`)?.classList.remove('hidden'); await atualizar(p); }
  else if (a === 'delc') { p.comentarios.splice(+t.dataset.i, 1); renderFeed(); await atualizar(p); }
  else if (a === 'del') { if (!await confirmarAcao('Excluir publicação?', 'Esta ação não pode ser desfeita.', 'Excluir')) return; posts = posts.filter(x => x !== p); if (local) salvarLocal(); else await supabaseClient.from('feed_posts').delete().eq('id', p.id); renderTudo(); toast('Post excluído'); }
  else if (a === 'denunciar') { if (!await confirmarAcao('Denunciar publicação?', 'A moderação irá analisar este post.', 'Denunciar')) return; p.denuncias ||= []; if (p.denuncias.some(d => +d.uid === +eu().id)) return toast('Você já denunciou este post.'); p.denuncias.push({ uid: eu().id, t: new Date().toISOString() }); if (p.denuncias.length >= 3 && p.status === 'publicado') { p.status = 'pendente'; p.motivo = 'Várias denúncias'; } renderTudo(); await atualizar(p); toast('Denúncia enviada. Obrigado!'); }
  else if ((a === 'aprovar' || a === 'remover') && STAFF()) { if (a === 'aprovar') { p.status = 'publicado'; p.motivo = null; p.denuncias = []; } else { p.status = 'removido'; p.motivo = card.querySelector('.modmot').value; } p.moderado_por = eu().nome; renderTudo(); await atualizar(p); toast(a === 'aprovar' ? 'Post aprovado' : 'Post removido'); }
  else if (a === 'fav') { await alternarFavorito(L); renderTudo(); }
  else if (a === 'res') { await solicitarReserva(L); renderTudo(); }
  else if (a === 'postar') { anexos = [{ id: +L, l: livro(L) }]; aba('feed'); $('comp').classList.add('open'); $('compTxt').focus(); renderComp(); }
  else if (a === 'canc') { if (!await confirmarAcao('Cancelar reserva?', 'Você poderá reservar novamente depois.', 'Cancelar reserva')) return; if (supabaseClient) await supabaseClient.from('reservas').update({ status: 'Cancelada' }).eq('id', t.dataset.r); await chamar('carregarReservas'); renderTudo(); toast('Reserva cancelada'); }
});
function iniciar() {
  if (!$('comp')) return;
  $('compTxt').onfocus = () => $('comp').classList.add('open'); $('compTxt').oninput = renderComp;
  $('compTxt').onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) publicar(); };
  $('btnFoto').onclick = () => $('arqMidia').click(); $('arqMidia').onchange = async e => { await addArquivos(e.target.files); e.target.value = ''; };
  $('btnLink').onclick = () => { $('linkBox').classList.toggle('hidden'); $('linkUrl').focus(); };
  $('linkAdd').onclick = () => { const u = $('linkUrl').value.trim(); if (!/^https:\/\//i.test(u)) return toast('Use um link https:// de imagem ou GIF.', 'erro'); if (midias.length >= 4) return toast('Máximo de 4 mídias por post.'); midias.push(u); $('linkUrl').value = ''; $('linkBox').classList.add('hidden'); renderComp(); };
  $('compTxt').onpaste = e => { const f = [...(e.clipboardData?.files || [])].filter(x => x.type.startsWith('image/')); if (f.length) { e.preventDefault(); addArquivos(f); } };
  $('pfEscolher').onclick = () => $('pfArq').click(); $('pfRemover').onclick = () => { fotoTmp = null; pintarPerfil(); };
  $('pfArq').onchange = async e => { try { if (e.target.files[0]) { fotoTmp = await lerImg(e.target.files[0], 256, .85, true); pintarPerfil(); } } catch (x) { toast(String(x), 'erro'); } e.target.value = ''; };
  ['pfBio', 'pfCidade', 'pfLivro'].forEach(i => $(i).oninput = pintarPerfil);
  $('pfSalvar').onclick = async () => { if (await gravarPerfil(eu().id, lerForm())) { renderTudo(); toast('Perfil atualizado!'); } };
  $('btnPub').onclick = publicar; $('btnLivro').onclick = () => { $('picker').classList.toggle('hidden'); renderPicker(); $('pickQ').focus(); };
  $('pickQ').oninput = renderPicker; $('favQ').oninput = renderFavs; $('modFiltro').onchange = renderMod; $('resFiltro').onchange = renderReservas; $('fFiltro').onchange = $('fOrdem').onchange = renderFeed;
  window.addEventListener('hashchange', () => aba(location.hash.slice(1)));
  aba(location.hash.slice(1)); renderComp();
  (window.appReady || Promise.resolve()).then(async () => { await Promise.all([carregarFeed(), carregarPerfis()]); renderTudo(); });
  if (supabaseClient) supabaseClient.channel('feed').on('postgres_changes', { event: '*', schema: 'public', table: 'feed_posts' }, async () => { if (!local) { await carregarFeed(); renderTudo(); } }).subscribe();
}
document.addEventListener('DOMContentLoaded', iniciar);
})();
