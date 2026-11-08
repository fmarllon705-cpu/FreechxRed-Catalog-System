// ==========================================
// VENOUS • CHAT EM TEMPO REAL
// Realtime: mensagens, progresso, membros, troca de livro, presença online,
// "digitando…", não lidas, reconexão automática e ressincronização.
// ==========================================
const TITULO_BASE = document.title.replace(/^\(\d+\)\s*/, '');
const EMOJIS = [...'😀😃😄😁😆😅😂🤣😊😇🙂😉😍🥰😘😋😜🤓😎🥳😏😢😭😡😱🤗🤔🤫🙄😴🤢🤠👋👌👍👎👏🙌🙏💪🧠👀💖💕💛💚💙💜🖤💔📚📖🔖'];
let listaChatsUsuario = [], chatAtivoSelecionado = null, modoOrigemLivro = 'acervo';
let canalGlobal = null, canalSala = null, tentativas = 0, digitando = {}, ultimoDigitando = 0;
const naoLidas = {}, online = new Set(), timersDigitando = {};
const $ = id => document.getElementById(id);
const logado = () => !!(usuarioAtual && usuarioAtual.id && usuarioAtual.nome !== 'Visitante (Público)');
const mesmoId = (a, b) => Number(a) === Number(b);
const chaveLido = id => `venous_lido_${usuarioAtual.id}_${id}`;
const ultimoLido = id => { try { return localStorage.getItem(chaveLido(id)) || '1970-01-01T00:00:00Z'; } catch (_) { return '1970-01-01T00:00:00Z'; } };

function fecharModal(id) { $(id)?.classList.remove('active'); }
function rolarChatParaFim() { const b = $('boxMensagensChat'); if (b) b.scrollTop = b.scrollHeight; }

// ---------- Som e notificações ----------
function tocarSomNotificacao() {
    try {
        const A = window.AudioContext || window.webkitAudioContext; if (!A) return;
        const ctx = (window._audioCtx ||= new A()); ctx.resume?.();
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 587.33; g.gain.value = 0.1; o.connect(g); g.connect(ctx.destination);
        o.start(); o.stop(ctx.currentTime + 0.15);
    } catch (_) {}
}
function notificar(nome, texto) {
    tocarSomNotificacao();
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        try {
            const n = new Notification(`Venous • ${nome}`, { body: texto.length > 80 ? texto.slice(0, 80) + '…' : texto, tag: 'venous-chat' });
            n.onclick = () => { window.focus(); n.close(); };
        } catch (_) {}
    }
}
function atualizarTitulo() {
    const n = Object.values(naoLidas).reduce((a, b) => a + b, 0);
    document.title = (n ? `(${n}) ` : '') + TITULO_BASE; window.MinhaArea?.onChatBadge?.(n);
}

// ---------- Não lidas ----------
async function calcularNaoLidas() {
    Object.keys(naoLidas).forEach(k => delete naoLidas[k]);
    const ids = listaChatsUsuario.map(c => c.id);
    if (!ids.length) return;
    const menor = ids.map(ultimoLido).sort()[0];
    const { data } = await supabaseClient.from('chat_mensagens').select('chat_id,created_at')
        .in('chat_id', ids).neq('usuario_id', usuarioAtual.id).gt('created_at', menor).limit(1000);
    (data || []).forEach(r => { if (r.created_at > ultimoLido(r.chat_id)) naoLidas[r.chat_id] = (naoLidas[r.chat_id] || 0) + 1; });
}
function marcarLidoAtivo() {
    if (!chatAtivoSelecionado || document.hidden) return;
    const t = $('boxMensagensChat')?.lastElementChild?.dataset.t;
    if (t) try { localStorage.setItem(chaveLido(chatAtivoSelecionado.id), t); } catch (_) {}
    if (naoLidas[chatAtivoSelecionado.id]) { delete naoLidas[chatAtivoSelecionado.id]; renderizarListaChats(); atualizarTitulo(); }
}

// ---------- Lista de conversas ----------
function renderizarListaChats() {
    const cont = $('listaConversas'); if (!cont) return;
    if (!listaChatsUsuario.length) { cont.innerHTML = '<p class="muted" style="font-size:.85rem;padding:10px">Você não possui conversas ativas.</p>'; return; }
    const q = ($('chatBusca')?.value || '').toLowerCase(), vis = listaChatsUsuario.filter(c => c.nome.toLowerCase().includes(q));
    if (!vis.length) { cont.innerHTML = '<p class="muted" style="font-size:.85rem;padding:10px">Nenhuma conversa encontrada.</p>'; return; }
    cont.innerHTML = vis.map(c => {
        const n = naoLidas[c.id] || 0, ativo = chatAtivoSelecionado && mesmoId(chatAtivoSelecionado.id, c.id);
        return `<div class="chat-item${ativo ? ' active' : ''}" data-chat="${c.id}"><i class="fa-solid ${c.tipo === 'grupo' ? 'fa-users' : 'fa-user'}"></i><span class="chat-nome">${escaparHTML(c.nome)}</span>${n ? `<span class="chat-badge">${n > 99 ? '99+' : n}</span>` : ''}<button class="chat-del" data-gerir="${c.id}" title="Limpar ou excluir" aria-label="Limpar ou excluir conversa"><i class="fa-solid fa-trash"></i></button></div>`;
    }).join('');
    cont.onclick = e => { const g = e.target.closest('[data-gerir]'); if (g) { e.stopPropagation(); return gerenciarConversa(listaChatsUsuario.find(c => String(c.id) === g.dataset.gerir)); } const el = e.target.closest('[data-chat]'); if (el) selecionarChat(listaChatsUsuario.find(c => String(c.id) === el.dataset.chat)); };
}

async function carregarListaChats() {
    const cont = $('listaConversas');
    if (!logado()) { if (cont) cont.innerHTML = '<p class="muted" style="padding:10px">Faça login para utilizar o chat.</p>'; return; }
    if (!supabaseClient) { if (cont) cont.innerHTML = '<p class="muted" style="padding:10px">Banco de dados desconectado.</p>'; return; }
    try {
        const { data: m, error } = await supabaseClient.from('chat_membros').select('chat_id').eq('usuario_id', usuarioAtual.id);
        if (error) throw error;
        const ids = (m || []).map(x => x.chat_id); let chats = [];
        if (ids.length) {
            const r = await supabaseClient.from('chats_grupos').select('*').in('id', ids).order('created_at', { ascending: false });
            if (r.error) throw r.error; chats = r.data || [];
        }
        const antes = listaChatsUsuario.map(c => c.id).sort().join();
        listaChatsUsuario = chats;
        await calcularNaoLidas(); renderizarListaChats(); atualizarTitulo();
        if (antes !== chats.map(c => c.id).sort().join() || !canalGlobal) assinar();
    } catch (err) {
        console.error('Erro ao carregar chats:', err);
        if (cont) cont.innerHTML = '<p style="color:var(--accent-red);padding:10px">Erro ao carregar conversas.</p>';
    }
}

// ---------- Realtime global (postgres_changes) ----------
async function assinar() {
    if (!supabaseClient || !logado()) return;
    if (canalGlobal) { const velho = canalGlobal; canalGlobal = null; supabaseClient.removeChannel(velho); }
    const ids = listaChatsUsuario.map(c => c.id), pg = (table, event, filter, fn) => ({ args: [{ event, schema: 'public', table, filter }, fn] });
    let ch = supabaseClient.channel('venous-chat-' + usuarioAtual.id)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_membros', filter: `usuario_id=eq.${usuarioAtual.id}` }, () => carregarListaChats());
    if (ids.length) {
        const porChat = `chat_id=in.(${ids.join(',')})`, ativo = n => chatAtivoSelecionado && mesmoId(chatAtivoSelecionado.id, n?.chat_id);
        ch = ch
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensagens', filter: porChat }, p => aoReceberMensagem(p.new))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'progresso_leitura', filter: porChat }, p => { if (ativo(p.new)) atualizarAreaLeitura(); })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_membros', filter: porChat }, p => { if (ativo(p.new)) atualizarAreaLeitura(); })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chats_grupos', filter: `id=in.(${ids.join(',')})` }, p => aoAtualizarChat(p.new));
    }
    ch.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_mensagens' }, p => { if (chatAtivoSelecionado && mesmoId(chatAtivoSelecionado.id, p.old?.chat_id)) carregarMensagens(); })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chats_grupos' }, p => { if (listaChatsUsuario.some(c => mesmoId(c.id, p.old?.id))) { if (chatAtivoSelecionado && mesmoId(chatAtivoSelecionado.id, p.old.id)) resetarPainelChat(); carregarListaChats(); } });
    canalGlobal = ch;
    ch.subscribe(status => {
        if (ch !== canalGlobal) return;
        if (status === 'SUBSCRIBED') { tentativas = 0; sincronizar(); }
        else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) setTimeout(assinar, Math.min(30000, 1000 * 2 ** tentativas++));
    });
}

// Busca o que foi perdido (queda de rede, aba em segundo plano)
async function sincronizar() {
    if (!logado() || !supabaseClient) return;
    if (chatAtivoSelecionado) {
        const ts = [...($('boxMensagensChat')?.querySelectorAll('[data-t]') || [])].map(e => e.dataset.t).filter(t => !t.startsWith('tmp')).sort();
        const q = supabaseClient.from('chat_mensagens').select('*').eq('chat_id', chatAtivoSelecionado.id).order('created_at');
        const { data } = ts.length ? await q.gt('created_at', ts[ts.length - 1]) : await q.limit(100);
        (data || []).forEach(m => adicionarMensagemNaTela(m));
        marcarLidoAtivo();
    }
    await calcularNaoLidas(); renderizarListaChats(); atualizarTitulo();
}

function aoReceberMensagem(m) {
    const ativo = chatAtivoSelecionado && mesmoId(chatAtivoSelecionado.id, m.chat_id), meu = mesmoId(m.usuario_id, usuarioAtual.id);
    if (ativo) { adicionarMensagemNaTela(m); delete digitando[m.usuario_id]; pintarDigitando(); if (!document.hidden) marcarLidoAtivo(); }
    if (meu) return;
    if (!ativo || document.hidden) {
        naoLidas[m.chat_id] = (naoLidas[m.chat_id] || 0) + (ativo && !document.hidden ? 0 : 1);
        renderizarListaChats(); atualizarTitulo(); notificar(m.nome_usuario || 'Membro do grupo', String(m.texto || ''));
    }
}
function aoAtualizarChat(n) {
    const i = listaChatsUsuario.findIndex(c => mesmoId(c.id, n.id)); if (i >= 0) listaChatsUsuario[i] = n;
    if (chatAtivoSelecionado && mesmoId(chatAtivoSelecionado.id, n.id)) { chatAtivoSelecionado = n; atualizarAreaLeitura(); }
    renderizarListaChats();
}

// ---------- Sala ativa: presença online + "digitando…" ----------
function sairDaSala() { if (canalSala) { supabaseClient.removeChannel(canalSala); canalSala = null; } online.clear(); digitando = {}; }
function entrarNaSala(chat) {
    sairDaSala(); if (!supabaseClient) return;
    const ch = supabaseClient.channel('sala:' + chat.id, { config: { presence: { key: String(usuarioAtual.id) }, broadcast: { self: false } } });
    ch.on('presence', { event: 'sync' }, () => { online.clear(); Object.keys(ch.presenceState()).forEach(k => online.add(Number(k))); pintarOnline(); })
      .on('broadcast', { event: 'digitando' }, ({ payload }) => mostrarDigitando(payload))
      .subscribe(async s => { if (s === 'SUBSCRIBED') await ch.track({ nome: usuarioAtual.nome }); });
    canalSala = ch;
}
function pintarOnline() {
    document.querySelectorAll('[data-uid]').forEach(e => e.classList.toggle('on', online.has(Number(e.dataset.uid))));
    const n = $('contadorOnline'); if (n) n.textContent = online.size ? ` • ${online.size} online` : '';
}
function anunciarDigitando() {
    const t = Date.now(); if (t - ultimoDigitando < 2000 || !canalSala) return; ultimoDigitando = t;
    canalSala.send({ type: 'broadcast', event: 'digitando', payload: { id: usuarioAtual.id, nome: usuarioAtual.nome } });
}
function mostrarDigitando(p) {
    digitando[p.id] = p.nome; clearTimeout(timersDigitando[p.id]);
    timersDigitando[p.id] = setTimeout(() => { delete digitando[p.id]; pintarDigitando(); }, 3500); pintarDigitando();
}
function pintarDigitando() {
    const el = $('indicadorDigitando'); if (!el) return; const n = Object.values(digitando);
    el.textContent = n.length ? `${n.join(', ')} ${n.length > 1 ? 'estão digitando…' : 'está digitando…'}` : '';
}

// ---------- Painel do chat (renderizado uma vez; só as partes mudam depois) ----------
async function selecionarChat(chat) {
    if (!chat) return;
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    chatAtivoSelecionado = chat; delete naoLidas[chat.id];
    renderizarListaChats(); atualizarTitulo(); entrarNaSala(chat); $('chatShell')?.classList.add('abrir');
    await renderizarPainelChatAtivo();
}

async function renderizarPainelChatAtivo() {
    const c = $('painelChatAtivo'), chat = chatAtivoSelecionado; if (!c || !chat) return;
    c.innerHTML = `
<div class="chat-head"><button class="btn btn-outline btn-sm chat-back" onclick="voltarListaChats()" aria-label="Voltar"><i class="fa-solid fa-arrow-left"></i></button><strong style="flex:1"><i class="fa-solid ${chat.tipo === 'grupo' ? 'fa-users' : 'fa-user'}"></i> ${escaparHTML(chat.nome)}<small id="contadorOnline"></small></strong>
<span style="display:flex;gap:6px"><button class="btn btn-outline btn-sm" onclick="abrirModalSelecionarLivro()"><i class="fa-solid fa-book-bookmark"></i> Livro</button><button class="btn btn-outline btn-sm" onclick="gerenciarConversa()" title="Limpar ou excluir conversa"><i class="fa-solid fa-broom"></i> Limpar / Excluir</button></span></div>
<div class="chat-leitura" id="areaLeitura"></div>
<div id="boxMensagensChat"></div>
<div class="chat-digitando" id="indicadorDigitando"></div>
<div class="chat-emoji" id="emojiPickerContainer">${EMOJIS.map(e => `<span onclick="inserirEmoji('${e}')">${e}</span>`).join('')}</div>
<div class="chat-form"><button type="button" class="btn btn-outline" onclick="alternarPickerEmoji()" title="Emoji">😊</button>
<input id="txtMensagemChat" placeholder="Digite sua mensagem..." autocomplete="off" maxlength="2000" oninput="anunciarDigitando()" onkeydown="if(event.key==='Enter')enviarMensagemChat()">
<button class="btn btn-primary" onclick="enviarMensagemChat()" title="Enviar"><i class="fa-solid fa-paper-plane"></i></button></div>`;
    await Promise.all([atualizarAreaLeitura(), carregarMensagens()]);
    $('txtMensagemChat')?.focus();
}

async function carregarMensagens() {
    const chat = chatAtivoSelecionado;
    const { data } = await supabaseClient.from('chat_mensagens').select('*').eq('chat_id', chat.id).order('created_at', { ascending: false }).limit(100);
    if (chat !== chatAtivoSelecionado) return;
    const box = $('boxMensagensChat'); if (!box) return;
    box.innerHTML = ''; (data || []).reverse().forEach(m => adicionarMensagemNaTela(m));
    rolarChatParaFim(); marcarLidoAtivo();
}

async function atualizarAreaLeitura() {
    const chat = chatAtivoSelecionado, area = $('areaLeitura'); if (!chat || !area) return;
    let capa = '', titulo = 'Nenhum livro definido para este grupo', total = 100;
    if (chat.livro_atual_id) {
        const l = (acervoCompleto || []).find(x => mesmoId(x.id, chat.livro_atual_id));
        if (l) { capa = l.capa_url || l.capaUrl || ''; titulo = l.titulo_principal || l.tituloPrincipal || 'Sem título'; total = parseInt(String(l.numero_paginas || '').replace(/\D/g, ''), 10) || 100; }
    } else if (chat.livro_externo_titulo) {
        capa = chat.livro_externo_capa || ''; titulo = chat.livro_externo_titulo; total = parseInt(chat.livro_externo_paginas, 10) || 100;
    }
    const [prog, mem] = await Promise.all([
        supabaseClient.from('progresso_leitura').select('*').eq('chat_id', chat.id),
        supabaseClient.from('chat_membros').select('usuarios_sistema(id,nome)').eq('chat_id', chat.id)
    ]);
    if (chat !== chatAtivoSelecionado || !$('areaLeitura')) return;
    const campo = $('inputMinhaPagina'), manter = campo && document.activeElement === campo ? campo.value : null;
    const membros = (mem.data || []).map(m => m.usuarios_sistema).filter(Boolean);
    area.innerHTML = `${capa ? `<img class="capa" src="${escaparHTML(capa)}" alt="" onerror="this.style.visibility='hidden'">` : '<div class="capa"><i class="fa-solid fa-book"></i></div>'}
<div style="flex:1;min-width:0"><h6 style="font-size:1rem">Lendo: <span style="color:var(--primary-color)">${escaparHTML(titulo)}</span></h6>
${membros.map(m => {
        const p = (prog.data || []).find(x => mesmoId(x.usuario_id, m.id)), pg = parseInt(p?.pagina_atual, 10) || 0, pct = Math.min(100, Math.round(pg / total * 100)), eu = mesmoId(m.id, usuarioAtual.id);
        return `<div class="leitor"><div class="leitor-top"><span><i class="ponto" data-uid="${Number(m.id)}"></i>${escaparHTML(m.nome)}${eu ? ' <span class="muted">(Você)</span>' : ''}</span><span class="muted">Pág. <b>${pg}</b> / ${total} (${pct}%)</span></div><div class="barra"><i style="width:${pct}%"></i></div>${eu ? `<div class="leitor-form"><label for="inputMinhaPagina" class="muted">Sua página:</label><input type="number" id="inputMinhaPagina" min="0" max="${total}" value="${pg}"><button class="btn btn-primary btn-sm" onclick="atualizarMeuProgresso(${total})"><i class="fa-solid fa-floppy-disk"></i> Salvar</button></div>` : ''}</div>`;
    }).join('')}</div>`;
    if (manter !== null) { const n = $('inputMinhaPagina'); if (n) { n.value = manter; n.focus(); } }
    pintarOnline();
}

// ---------- Mensagens ----------
function adicionarMensagemNaTela(m) {
    const box = $('boxMensagensChat'); if (!box || !chatAtivoSelecionado || !mesmoId(m.chat_id, chatAtivoSelecionado.id)) return null;
    if (m.created_at && m.created_at !== 'tmp' && new Date(m.created_at) <= new Date(corteChat(m.chat_id))) return null;
    if (m.id != null && box.querySelector(`[data-id="${CSS.escape(String(m.id))}"]`)) return null;
    const meu = mesmoId(m.usuario_id, usuarioAtual.id), perto = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
    const hora = new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const d = document.createElement('div');
    d.className = 'msg' + (meu ? ' msg-mine' : ''); d.dataset.id = m.id ?? ''; d.dataset.t = m.created_at || '';
    d.innerHTML = `<small>${meu ? 'Você' : escaparHTML(m.nome_usuario || 'Usuário')} • ${hora}</small><div>${escaparHTML(m.texto)}</div>`;
    const ant = [...box.children].reverse().find(e => e.classList.contains('msg')), dia = x => new Date(!x || x === 'tmp' ? Date.now() : x).toDateString();
    if (!ant || dia(ant.dataset.t) !== dia(m.created_at)) { const sp = document.createElement('div'); sp.className = 'dia-sep'; sp.textContent = new Date(!m.created_at || m.created_at === 'tmp' ? Date.now() : m.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' }); box.appendChild(sp); }
    box.appendChild(d); if (meu || perto) rolarChatParaFim();
    return d;
}

async function enviarMensagemChat() {
    const input = $('txtMensagemChat'); if (!input || !chatAtivoSelecionado || !logado()) return;
    const texto = input.value.trim(); if (!texto) return;
    const chatId = chatAtivoSelecionado.id; input.value = ''; input.focus();
    const el = adicionarMensagemNaTela({ id: 'tmp' + Date.now() + Math.random(), chat_id: chatId, usuario_id: usuarioAtual.id, nome_usuario: usuarioAtual.nome, texto, created_at: 'tmp' });
    el?.classList.add('pendente');
    const { data, error } = await supabaseClient.from('chat_mensagens')
        .insert([{ chat_id: chatId, usuario_id: usuarioAtual.id, nome_usuario: usuarioAtual.nome, texto }]).select().single();
    if (error || !data) {
        console.error('Erro ao enviar mensagem:', error);
        if (el) { el.classList.remove('pendente'); el.classList.add('msg-erro'); el.querySelector('div').textContent = texto + '  ⚠ Falha ao enviar — clique para reenviar'; el.onclick = () => { el.remove(); input.value = texto; enviarMensagemChat(); }; }
        return;
    }
    const real = $('boxMensagensChat')?.querySelector(`[data-id="${CSS.escape(String(data.id))}"]`);
    if (real && real !== el) el?.remove();
    else if (el) { el.classList.remove('pendente'); el.dataset.id = data.id; el.dataset.t = data.created_at; }
    marcarLidoAtivo();
}

// ---------- Emojis, livro e progresso ----------
function alternarPickerEmoji() { $('emojiPickerContainer')?.classList.toggle('aberto'); }
function inserirEmoji(e) { const i = $('txtMensagemChat'); if (i) { i.value += e; i.focus(); } }

async function salvarLivroLeituraConjunta() {
    if (!chatAtivoSelecionado) return; let d;
    if (modoOrigemLivro === 'acervo') {
        const id = parseInt($('selectLivroAcervoChat')?.value, 10); if (!id) return alert('Selecione um livro do acervo.');
        d = { livro_atual_id: id, livro_externo_titulo: null, livro_externo_capa: null, livro_externo_paginas: null };
    } else {
        const t = $('txtLivroForaTitulo')?.value.trim(); if (!t) return alert('Informe o título do livro.');
        d = { livro_atual_id: null, livro_externo_titulo: t, livro_externo_capa: $('txtLivroForaCapa')?.value.trim() || null, livro_externo_paginas: parseInt($('numLivroForaPaginas')?.value, 10) || 100 };
    }
    const { data, error } = await supabaseClient.from('chats_grupos').update(d).eq('id', chatAtivoSelecionado.id).select('*').single();
    if (error) return alert('Erro ao salvar livro: ' + error.message);
    aoAtualizarChat(data); fecharModal('modalSelecionarLivroChat');
}

async function atualizarMeuProgresso(total) {
    const inp = $('inputMinhaPagina'); if (!inp || !chatAtivoSelecionado || !logado()) return;
    const max = parseInt(total, 10) || 100, pag = Math.max(0, Math.min(parseInt(inp.value, 10) || 0, max));
    const { error } = await supabaseClient.from('progresso_leitura').upsert([{ chat_id: Number(chatAtivoSelecionado.id), usuario_id: Number(usuarioAtual.id), pagina_atual: pag, total_paginas: max, updated_at: new Date().toISOString() }], { onConflict: 'chat_id,usuario_id' });
    if (error) return alert('Erro ao salvar progresso: ' + error.message);
    atualizarAreaLeitura();
}

// Perfil (favoritos/reservas/feed): ver minha-area.js
function carregarPerfilUsuario() {}

// ---------- Modais: grupos, conversas diretas e livro ----------
function abrirModalNovoGrupo() {
    const container = document.getElementById('listaMembrosParaGrupo');
    if (!container) return;
    container.innerHTML = '';

    const usuariosDisponiveis = Array.isArray(listaUsuarios)
        ? listaUsuarios.filter(u => usuarioAtual && Number(u.id) !== Number(usuarioAtual.id))
        : [];

    if (usuariosDisponiveis.length === 0) {
        container.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem;">Nenhum outro usuário disponível.</p>`;
    }

    usuariosDisponiveis.forEach(u => {
        container.innerHTML += `
            <label style="display:flex; align-items:center; gap:8px; margin-bottom:8px; font-size:0.88rem; cursor:pointer;">
                <input type="checkbox" class="chk-membro-grupo" value="${Number(u.id)}">
                ${escaparHTML(u.nome)} (${escaparHTML(u.email)})
            </label>
        `;
    });

    const modal = document.getElementById('modalNovoGrupo');
    if (modal) modal.classList.add('active');
}

async function confirmarCriacaoGrupo() {
    if (!usuarioAtual || !usuarioAtual.id) {
        alert('Você precisa estar logado para criar um grupo.');
        return;
    }

    const inputNome = document.getElementById('txtNomeNovoGrupo');
    const nomeGrupo = inputNome ? inputNome.value.trim() : '';
    if (!nomeGrupo) {
        alert('Informe o nome do clube/grupo.');
        return;
    }

    const checkboxes = document.querySelectorAll('.chk-membro-grupo:checked');
    const idsSelecionados = Array.from(checkboxes).map(cb => Number(cb.value));
    idsSelecionados.push(Number(usuarioAtual.id));
    const idsUnicos = [...new Set(idsSelecionados)];

    try {
        const { data: novoGrupo, error: grupoError } = await supabaseClient
            .from('chats_grupos')
            .insert([{ nome: nomeGrupo, tipo: 'grupo', criador_id: usuarioAtual.id }])
            .select('*')
            .single();

        if (grupoError) throw grupoError;

        const registrosMembros = idsUnicos.map(uid => ({ chat_id: novoGrupo.id, usuario_id: uid }));
        { const { error: e2 } = await supabaseClient.from('chat_membros').insert(registrosMembros); if (e2) throw e2; }

        fecharModal('modalNovoGrupo');
        if (inputNome) inputNome.value = '';
        await carregarListaChats();
        await selecionarChat(novoGrupo);
    } catch (err) {
        alert('Erro ao criar grupo: ' + err.message);
    }
}

function abrirModalNovoChatP2P() {
    const select = document.getElementById('selectUsuarioP2P');
    if (!select) return;
    select.innerHTML = '';

    const usuariosDisponiveis = Array.isArray(listaUsuarios)
        ? listaUsuarios.filter(u => usuarioAtual && Number(u.id) !== Number(usuarioAtual.id))
        : [];

    usuariosDisponiveis.forEach(u => {
        select.innerHTML += `<option value="${Number(u.id)}">${escaparHTML(u.nome)} (${escaparHTML(u.email)})</option>`;
    });

    const modal = document.getElementById('modalNovoChatP2P');
    if (modal) modal.classList.add('active');
}

async function confirmarCriacaoP2P() {
    const select = document.getElementById('selectUsuarioP2P');
    const destinatarioId = select ? Number(select.value) : 0;

    if (!destinatarioId) {
        alert('Selecione um usuário.');
        return;
    }

    try {
        await criarOuAbrirChat(destinatarioId);
        fecharModal('modalNovoChatP2P');
    } catch (err) {
        console.error('Erro ao iniciar conversa:', err);
    }
}

async function criarOuAbrirChat(outroUsuarioId) {
    if (!usuarioAtual || !usuarioAtual.id) return;

    try {
        const { data: meusChats } = await supabaseClient
            .from('chat_membros')
            .select('chat_id')
            .eq('usuario_id', usuarioAtual.id);

        const meusChatIds = (meusChats || []).map(c => c.chat_id);

        if (meusChatIds.length > 0) {
            const { data: chatsExistentes } = await supabaseClient
                .from('chat_membros')
                .select(`chat_id, chats_grupos!inner(*)`)
                .eq('usuario_id', outroUsuarioId)
                .in('chat_id', meusChatIds);

            const chatComum = (chatsExistentes || []).find(i => i.chats_grupos && i.chats_grupos.tipo === 'p2p');
            if (chatComum) {
                await carregarListaChats();
                await selecionarChat(chatComum.chats_grupos);
                return chatComum.chats_grupos;
            }
        }

        const outroUsuario = (listaUsuarios || []).find(u => Number(u.id) === Number(outroUsuarioId));
        const { data: novoChat } = await supabaseClient
            .from('chats_grupos')
            .insert([{ nome: `Chat: ${outroUsuario ? outroUsuario.nome : outroUsuarioId}`, tipo: 'p2p', criador_id: usuarioAtual.id }])
            .select('*')
            .single();

        await supabaseClient.from('chat_membros').insert([
            { chat_id: novoChat.id, usuario_id: usuarioAtual.id },
            { chat_id: novoChat.id, usuario_id: outroUsuarioId }
        ]);

        await carregarListaChats();
        await selecionarChat(novoChat);
        return novoChat;
    } catch (err) {
        alert('Erro ao criar conversa: ' + err.message);
    }
}

function abrirModalSelecionarLivro() {
    if (!chatAtivoSelecionado) return;
    const select = document.getElementById('selectLivroAcervoChat');
    if (select) {
        select.innerHTML = '<option value="">Selecione um livro...</option>';
        (acervoCompleto || []).forEach(l => {
            const selected = Number(chatAtivoSelecionado.livro_atual_id) === Number(l.id) ? 'selected' : '';
            select.innerHTML += `<option value="${l.id}" ${selected}>${escaparHTML(l.titulo_principal || l.tituloPrincipal || 'Sem título')}</option>`;
        });
    }
    const modal = document.getElementById('modalSelecionarLivroChat');
    if (modal) modal.classList.add('active');
}

function alternarOrigemLivroChat(origem) {
    modoOrigemLivro = origem;
    const btnAcervo = document.getElementById('btnAbaAcervoChat');
    const btnFora = document.getElementById('btnAbaForaChat');
    const boxAcervo = document.getElementById('boxLivroAcervoChat');
    const boxFora = document.getElementById('boxLivroForaChat');

    if (btnAcervo) btnAcervo.className = origem === 'acervo' ? 'btn btn-primary' : 'btn btn-outline';
    if (btnFora) btnFora.className = origem === 'fora' ? 'btn btn-primary' : 'btn btn-outline';
    if (boxAcervo) boxAcervo.style.display = origem === 'acervo' ? 'block' : 'none';
    if (boxFora) boxFora.style.display = origem === 'fora' ? 'block' : 'none';
}


// ---------- Limpar / excluir conversas ----------
const chaveCorte = id => `venous_corte_${usuarioAtual.id}_${id}`;
function corteChat(id) { try { return localStorage.getItem(chaveCorte(id)) || '1970-01-01T00:00:00Z'; } catch (_) { return '1970-01-01T00:00:00Z'; } }
const confirmar = (t, x, r) => window.confirmarAcao ? window.confirmarAcao(t, x, r) : Promise.resolve(confirm(t + '\n' + x));
const avisar = m => alert(m);
function voltarListaChats() { $('chatShell')?.classList.remove('abrir'); }
function resetarPainelChat() { chatAtivoSelecionado = null; sairDaSala(); voltarListaChats(); const c = $('painelChatAtivo'); if (c) c.innerHTML = '<div class="empty" style="margin:auto;border:0"><i class="fa-solid fa-comments"></i>Selecione ou crie uma conversa para começar.</div>'; renderizarListaChats(); }
function gerenciarConversa(chat = chatAtivoSelecionado) {
    if (!chat) return;
    const dono = mesmoId(chat.criador_id, usuarioAtual.id) || usuarioAtual.cargo === 'bibliotecario', grupo = chat.tipo === 'grupo';
    $('opcoesChat').innerHTML = `<p class="muted" style="margin-bottom:4px">${escaparHTML(chat.nome)}</p>
<button class="opt" data-op="mim"><i class="fa-solid fa-eye-slash"></i><span><b>Limpar para mim</b><small>Oculta o histórico atual só para você; os outros continuam vendo.</small></span></button>
${!grupo || dono ? `<button class="opt danger" data-op="todos"><i class="fa-solid fa-broom"></i><span><b>Apagar mensagens para todos</b><small>Remove todas as mensagens para todos os participantes.</small></span></button>` : ''}
<button class="opt danger" data-op="sair"><i class="fa-solid fa-trash"></i><span><b>${grupo ? (dono ? 'Excluir clube' : 'Sair do clube') : 'Excluir conversa'}</b><small>${grupo && dono ? 'Remove o clube e todo o histórico para todos.' : 'Remove a conversa da sua lista.'}</small></span></button>`;
    $('opcoesChat').onclick = async e => { const o = e.target.closest('[data-op]')?.dataset.op; if (!o) return; fecharModal('modalGerenciarChat'); await ({ mim: limparParaMim, todos: apagarParaTodos, sair: sairOuExcluir })[o](chat); };
    $('modalGerenciarChat').classList.add('active');
}
async function limparParaMim(chat, silencioso) {
    if (!silencioso && !await confirmar('Limpar conversa para você?', 'O histórico atual ficará oculto apenas para você.', 'Limpar')) return;
    let t = new Date().toISOString();
    try { const { data } = await supabaseClient.from('chat_mensagens').select('created_at').eq('chat_id', chat.id).order('created_at', { ascending: false }).limit(1); if (data?.[0]) t = data[0].created_at; } catch (_) {}
    try { localStorage.setItem(chaveCorte(chat.id), t); localStorage.setItem(chaveLido(chat.id), t); } catch (_) {}
    delete naoLidas[chat.id]; renderizarListaChats(); atualizarTitulo();
    if (chatAtivoSelecionado && mesmoId(chatAtivoSelecionado.id, chat.id)) carregarMensagens();
    if (!silencioso) avisar('Conversa limpa.');
}
async function limparTodasConversas() {
    if (!listaChatsUsuario.length) return avisar('Você não tem conversas.');
    if (!await confirmar('Limpar todas as conversas?', 'O histórico de todas as suas conversas ficará oculto apenas para você.', 'Limpar todas')) return;
    for (const c of listaChatsUsuario) await limparParaMim(c, true); avisar('Todas as conversas foram limpas.');
}
async function apagarParaTodos(chat) {
    if (!await confirmar('Apagar mensagens para todos?', 'Todas as mensagens serão removidas para todos os participantes. Não dá para desfazer.', 'Apagar')) return;
    const { error } = await supabaseClient.from('chat_mensagens').delete().eq('chat_id', chat.id);
    if (error) return avisar('Erro ao apagar: ' + error.message);
    delete naoLidas[chat.id]; if (chatAtivoSelecionado && mesmoId(chatAtivoSelecionado.id, chat.id)) carregarMensagens(); renderizarListaChats(); atualizarTitulo(); avisar('Mensagens apagadas.');
}
async function sairOuExcluir(chat) {
    const dono = mesmoId(chat.criador_id, usuarioAtual.id) || usuarioAtual.cargo === 'bibliotecario', apagarTudo = chat.tipo === 'grupo' && dono;
    if (!await confirmar(apagarTudo ? 'Excluir clube?' : 'Remover conversa?', apagarTudo ? 'O clube e todo o histórico serão apagados para todos.' : 'Ela sairá da sua lista.', apagarTudo ? 'Excluir' : 'Remover')) return;
    let erro;
    if (apagarTudo) erro = (await supabaseClient.from('chats_grupos').delete().eq('id', chat.id)).error;
    else {
        erro = (await supabaseClient.from('chat_membros').delete().eq('chat_id', chat.id).eq('usuario_id', usuarioAtual.id)).error;
        if (!erro) { const { count } = await supabaseClient.from('chat_membros').select('*', { count: 'exact', head: true }).eq('chat_id', chat.id); if (!count) await supabaseClient.from('chats_grupos').delete().eq('id', chat.id); }
    }
    if (erro) return avisar('Erro: ' + erro.message);
    listaChatsUsuario = listaChatsUsuario.filter(c => !mesmoId(c.id, chat.id));
    if (chatAtivoSelecionado && mesmoId(chatAtivoSelecionado.id, chat.id)) resetarPainelChat();
    await carregarListaChats(); avisar(apagarTudo ? 'Clube excluído.' : 'Conversa removida.');
}

// ---------- Inicialização ----------
document.addEventListener('DOMContentLoaded', () => {
    $('chatBusca')?.addEventListener('input', renderizarListaChats);
    (window.appReady || Promise.resolve()).then(async () => { await carregarListaChats(); if ($('tab-perfil')) carregarPerfilUsuario(); });
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) { marcarLidoAtivo(); sincronizar(); } });
window.addEventListener('online', () => { assinar(); if (canalSala && chatAtivoSelecionado) entrarNaSala(chatAtivoSelecionado); });
window.addEventListener('focus', marcarLidoAtivo);
