// ==========================================
// MÓDULO DE CHAT & CLUBE DO LEITOR
// ==========================================

let listaChatsUsuario = [];
let chatAtivoSelecionado = null;
let modoOrigemLivro = 'acervo';
let escutaChatChannel = null;

// ==========================================
// UTILITÁRIOS
// ==========================================

if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
}

function escaparHTML(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function fecharModal(idModal) {
    const modal = document.getElementById(idModal);
    if (modal) {
        modal.classList.remove('active');
    }
}

// ==========================================
// NOTIFICAÇÕES (SOM + WEB NOTIFICATION)
// ==========================================

function tocarSomNotificacao() {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;

        const audioCtx = new AudioContextClass();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
        console.warn("Não foi possível tocar o áudio da notificação:", e);
    }
}

function exibirNotificacaoMensagem(nomeRemetente, textoMensagem) {
    tocarSomNotificacao();

    textoMensagem = String(textoMensagem || '');
    nomeRemetente = String(nomeRemetente || 'Membro do Grupo');

    if ("Notification" in window && Notification.permission === "granted") {
        try {
            new Notification(`Nova mensagem de ${nomeRemetente}`, {
                body: textoMensagem.length > 50 ? textoMensagem.substring(0, 50) + "..." : textoMensagem,
                icon: 'https://cdn-icons-png.flaticon.com/512/134/134937.png'
            });
        } catch (err) {
            console.warn("Erro ao exibir Web Notification:", err);
        }
    }
}

// ==========================================
// REALTIME DO SUPABASE
// ==========================================

function inicializarEscutaRealtimeMensagens() {
    if (typeof supabaseClient === 'undefined' || !supabaseClient) {
        console.warn('Supabase ainda não está disponível para o realtime do chat.');
        return;
    }

    if (escutaChatChannel) {
        try {
            supabaseClient.removeChannel(escutaChatChannel);
        } catch (e) {
            console.warn('Erro ao remover canal anterior:', e);
        }
    }

    escutaChatChannel = supabaseClient
        .channel('public:chat_mensagens')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_mensagens'
            },
            payload => {
                const novaMsg = payload.new;

                if (chatAtivoSelecionado && Number(novaMsg.chat_id) === Number(chatAtivoSelecionado.id)) {
                    if (!usuarioAtual || Number(novaMsg.usuario_id) !== Number(usuarioAtual.id)) {
                        adicionarMensagemNaTela(novaMsg);
                    }
                }

                if (usuarioAtual && Number(novaMsg.usuario_id) !== Number(usuarioAtual.id)) {
                    exibirNotificacaoMensagem(
                        novaMsg.nome_usuario || 'Membro do Grupo',
                        novaMsg.texto
                    );
                }
            }
        )
        .subscribe(status => {
            console.log('Status realtime do chat:', status);
        });
}

// ==========================================
// CARREGAMENTO DE CHATS E PERFIL
// ==========================================

async function carregarPerfilUsuario() {
    await carregarListaChats();
}

async function carregarListaChats() {
    const containerLista = document.getElementById('listaConversas');
    if (!containerLista) return;

    if (!usuarioAtual || !usuarioAtual.id || usuarioAtual.nome === 'Visitante (Público)') {
        containerLista.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem; padding:10px;">Faça login para utilizar o chat.</p>';
        return;
    }

    if (typeof supabaseClient === 'undefined' || !supabaseClient) {
        containerLista.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem; padding:10px;">Banco de dados desconectado.</p>';
        return;
    }

    try {
        const { data: membrosData, error: membrosError } = await supabaseClient
            .from('chat_membros')
            .select('chat_id')
            .eq('usuario_id', usuarioAtual.id);

        if (membrosError) throw membrosError;

        if (!membrosData || membrosData.length === 0) {
            listaChatsUsuario = [];
            containerLista.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem; padding:10px;">Você não possui conversas ativas.</p>';
            return;
        }

        const chatIds = membrosData.map(m => m.chat_id);

        const { data: chats, error: chatsError } = await supabaseClient
            .from('chats_grupos')
            .select('*')
            .in('id', chatIds)
            .order('created_at', { ascending: false });

        if (chatsError) throw chatsError;

        listaChatsUsuario = chats || [];
        containerLista.innerHTML = '';

        listaChatsUsuario.forEach(c => {
            const isGrupo = c.tipo === 'grupo';
            const icon = isGrupo ? 'fa-users' : 'fa-user';
            const isActive = chatAtivoSelecionado && Number(chatAtivoSelecionado.id) === Number(c.id);

            const btn = document.createElement('div');
            btn.className = `chat-item ${isActive ? 'active' : ''}`;
            btn.style.cssText = `
                padding: 12px 14px;
                border-radius: 8px;
                background: ${isActive ? 'var(--primary-color)' : 'var(--bg-tertiary)'};
                color: ${isActive ? '#fff' : 'var(--text-main)'};
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 12px;
                font-size: 0.9rem;
                font-weight: 500;
                transition: all 0.2s ease;
            `;

            btn.innerHTML = `
                <i class="fa-solid ${icon}"></i>
                <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1;">
                    ${escaparHTML(c.nome)}
                </span>
            `;

            btn.onclick = () => selecionarChat(c);
            containerLista.appendChild(btn);
        });

    } catch (err) {
        console.error("Erro ao carregar lista de chats:", err);
        containerLista.innerHTML = `<p style="color:var(--accent-red); font-size:0.85rem; padding:10px;">Erro ao carregar conversas.</p>`;
    }
}

// ==========================================
// SELECIONAR CHAT
// ==========================================

async function selecionarChat(chat) {
    if (!chat) return;
    chatAtivoSelecionado = chat;
    await carregarListaChats();
    await renderizarPainelChatAtivo();
}

// ==========================================
// PAINEL DO CHAT
// ==========================================

// ==========================================
// PAINEL DO CHAT & PROGRESSÃO POR PÁGINA
// ==========================================

async function renderizarPainelChatAtivo() {
    const container = document.getElementById('painelChatAtivo');
    if (!container || !chatAtivoSelecionado) return;

    let capaLivro = '';
    let tituloLivro = 'Nenhum livro definido para este grupo';
    let totalPaginasLivro = 100;

    // Buscar páginas reais do acervo ou do livro externo
    if (chatAtivoSelecionado.livro_atual_id) {
        const livroAcervo = Array.isArray(acervoCompleto)
            ? acervoCompleto.find(l => Number(l.id) === Number(chatAtivoSelecionado.livro_atual_id))
            : null;

        if (livroAcervo) {
            capaLivro = livroAcervo.capa_url || '';
            tituloLivro = livroAcervo.titulo_principal || livroAcervo.tituloPrincipal || 'Sem título';
            
            // Extrai apenas os números do campo de páginas (ex: "240 p." -> 240)
            const paginasDigitos = String(livroAcervo.numero_paginas || '').replace(/\D/g, '');
            totalPaginasLivro = parseInt(paginasDigitos, 10) || 100;
        }
    } else if (chatAtivoSelecionado.livro_externo_titulo) {
        capaLivro = chatAtivoSelecionado.livro_externo_capa || '';
        tituloLivro = chatAtivoSelecionado.livro_externo_titulo;
        totalPaginasLivro = parseInt(chatAtivoSelecionado.livro_externo_paginas, 10) || 100;
    }

    let progressos = [];
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        const { data } = await supabaseClient
            .from('progresso_leitura')
            .select('*')
            .eq('chat_id', chatAtivoSelecionado.id);
        progressos = data || [];
    }

    let membrosInfos = [];
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        const { data: membrosData } = await supabaseClient
            .from('chat_membros')
            .select(`usuario_id, usuarios_sistema(id, nome, email)`)
            .eq('chat_id', chatAtivoSelecionado.id);
        membrosInfos = (membrosData || []).map(m => m.usuarios_sistema).filter(Boolean);
    }

    let htmlProgressos = '';
    membrosInfos.forEach(membro => {
        const prog = progressos.find(p => Number(p.usuario_id) === Number(membro.id)) || {
            pagina_atual: 0,
            total_paginas: totalPaginasLivro
        };

        const paginaAtual = parseInt(prog.pagina_atual, 10) || 0;
        const totalPaginas = totalPaginasLivro > 0 ? totalPaginasLivro : 100;
        const pct = Math.min(100, Math.round((paginaAtual / totalPaginas) * 100));
        const isMe = usuarioAtual && Number(membro.id) === Number(usuarioAtual.id);

        htmlProgressos += `
            <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-color); padding: 12px 16px; border-radius: 8px; margin-bottom: 10px;">
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; margin-bottom: 8px;">
                    <span style="color: var(--text-main); font-weight: 600;">
                        <i class="fa-solid fa-circle-user" style="margin-right: 6px; color: var(--primary-color);"></i>
                        ${escaparHTML(membro.nome)} ${isMe ? '<span style="opacity:0.7; font-weight:normal;">(Você)</span>' : ''}
                    </span>
                    <span style="font-size:0.82rem; color: var(--text-muted);">
                        Pág. <strong style="color:var(--text-main);">${paginaAtual}</strong> / ${totalPaginas} 
                        (<strong style="color:var(--primary-color);">${pct}%</strong>)
                    </span>
                </div>

                <div style="width:100%; background: rgba(0,0,0,0.3); height:10px; border-radius:10px; overflow:hidden;">
                    <div style="width:${pct}%; background: linear-gradient(90deg, #0284c7 0%, #38bdf8 100%); height:100%; border-radius:10px; transition: width 0.4s ease-in-out;"></div>
                </div>

                ${isMe ? `
                    <div style="display:flex; gap:10px; align-items:center; margin-top:12px;">
                        <label style="font-size:0.8rem; color:var(--text-muted);">Sua página atual:</label>
                        <input type="number" id="inputMinhaPagina" value="${paginaAtual}" min="0" max="${totalPaginas}" style="width:90px; padding:6px 10px; font-size:0.85rem; background:var(--bg-primary); color:var(--text-main); border:1px solid var(--border-color); border-radius:6px; text-align:center;">
                        <button class="btn btn-primary" style="padding:6px 14px; font-size:0.8rem; border-radius:6px;" onclick="atualizarMeuProgresso(${totalPaginas})">
                            <i class="fa-solid fa-floppy-disk"></i> Salvar
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    });

    const capaHtml = capaLivro
        ? `<img src="${escaparHTML(capaLivro)}" style="width:85px; height:125px; object-fit:cover; border-radius:8px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); flex-shrink: 0;" onerror="this.onerror=null; this.parentNode.innerHTML='<div style=\\'width:85px; height:125px; background:var(--bg-tertiary); display:flex; align-items:center; justify-content:center; border-radius:8px; flex-shrink: 0;\\'><i class=\\'fa-solid fa-book fa-2x\\'></i></div>';">`
        : `<div style="width:85px; height:125px; background:var(--bg-tertiary); display:flex; flex-direction:column; align-items:center; justify-content:center; border-radius:8px; border:1px solid var(--border-color); color:var(--text-muted); flex-shrink: 0;"><i class="fa-solid fa-book" style="font-size:2rem;"></i></div>`;

    let msgs = [];
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        const { data } = await supabaseClient
            .from('chat_mensagens')
            .select('*')
            .eq('chat_id', chatAtivoSelecionado.id)
            .order('created_at', { ascending: true });
        msgs = data || [];
    }

    container.innerHTML = `
        <div style="padding:16px 20px; background:var(--bg-card); border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
            <strong style="font-size:1.05rem; color:var(--text-main);">
                <i class="fa-solid ${chatAtivoSelecionado.tipo === 'grupo' ? 'fa-users' : 'fa-user'}" style="margin-right:8px; color:var(--primary-color);"></i>
                ${escaparHTML(chatAtivoSelecionado.nome)}
            </strong>
            <button class="btn btn-outline" style="font-size:0.85rem; padding:8px 14px; border-radius:6px;" onclick="abrirModalSelecionarLivro()">
                <i class="fa-solid fa-book-bookmark"></i> Definir Livro
            </button>
        </div>

        <div style="background: var(--bg-secondary); padding: 18px 20px; border-bottom: 1px solid var(--border-color); display: flex; gap: 20px; align-items: flex-start; max-height: 260px; overflow-y: auto;">
            ${capaHtml}
            <div style="flex:1;">
                <h6 style="font-size:1rem; margin-bottom:12px; color:var(--text-main); font-weight:600;">
                    Lendo: <span style="color:var(--primary-color);">${escaparHTML(tituloLivro)}</span>
                </h6>
                ${htmlProgressos}
            </div>
        </div>

        <div id="boxMensagensChat" style="flex:1; padding:20px; overflow-y:auto; display:flex; flex-direction:column; gap:12px; min-height:260px; background:var(--bg-primary);"></div>

        <div id="emojiPickerContainer" style="display:none; padding:12px; background:var(--bg-secondary); border-top:1px solid var(--border-color); flex-wrap:wrap; gap:8px; max-height:130px; overflow-y:auto;">
            ${['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😋','😜','🤪','🤓','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','😣','😫','😩','🥺','😢','😭','😤','😠','😡','🤯','😳','😱','🤗','🤔','🤭','🤫','😶','😐','😑','😬','🙄','😯','🥱','😴','😵','🤐','🤢','🤧','😷','🤠','🥳','🤡','💩','👻','💀','👽','🤖','🎃','😺','😸','😹','😻','👋','🤚','🖐','✋','👌','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝','👍','👎','✊','👊','👏','🙌','👐','🤲','🤝','🙏','💪','🧠','👀','❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣','💕','💞','💓','💗','💖','💘','💝','📚','📖','🔖','📕','📗','📘','📙'].map(emoji => 
                `<span style="font-size:1.3rem; cursor:pointer; padding:4px; transition:transform 0.1s;" onclick="inserirEmoji('${emoji}')">${emoji}</span>`
            ).join('')}
        </div>

        <div style="padding:14px 18px; border-top:1px solid var(--border-color); display:flex; gap:10px; background:var(--bg-card); align-items:center;">
            <button type="button" class="btn btn-outline" style="padding:10px 14px; font-size:1.1rem; cursor:pointer;" onclick="alternarPickerEmoji()" title="Inserir Emoji">😊</button>
            <input type="text" id="txtMensagemChat" placeholder="Digite sua mensagem..." style="flex:1; padding:12px 16px; border-radius:8px; border:1px solid var(--border-color); background:var(--bg-primary); color:var(--text-main); font-size:0.92rem;" onkeypress="if(event.key==='Enter') enviarMensagemChat()">
            <button class="btn btn-primary" style="padding:12px 18px; border-radius:8px;" onclick="enviarMensagemChat()"><i class="fa-solid fa-paper-plane"></i></button>
        </div>
    `;

    const boxMsgs = document.getElementById('boxMensagensChat');
    if (!boxMsgs) return;
    boxMsgs.innerHTML = '';
    msgs.forEach(m => adicionarMensagemNaTela(m));
    rolarChatParaFim();
}

// ==========================================
// EMOJIS & INTERAÇÃO
// ==========================================

function alternarPickerEmoji() {
    const container = document.getElementById('emojiPickerContainer');
    if (container) {
        container.style.display = (container.style.display === 'none' || container.style.display === '') ? 'flex' : 'none';
    }
}

function inserirEmoji(emoji) {
    const input = document.getElementById('txtMensagemChat');
    if (input) {
        input.value += emoji;
        input.focus();
    }
}

// ==========================================
// SALVAR LIVRO COM PERSISTÊNCIA COMPLETA
// ==========================================

async function salvarLivroLeituraConjunta() {
    if (!chatAtivoSelecionado) return;
    let dadosAtualizacao = {};

    if (modoOrigemLivro === 'acervo') {
        const livroId = parseInt(document.getElementById('selectLivroAcervoChat')?.value, 10);
        if (!livroId) {
            alert('Selecione um livro do acervo.');
            return;
        }
        dadosAtualizacao = {
            livro_atual_id: livroId,
            livro_externo_titulo: null,
            livro_externo_capa: null,
            livro_externo_paginas: null
        };
    } else {
        const titulo = document.getElementById('txtLivroForaTitulo')?.value.trim();
        const capa = document.getElementById('txtLivroForaCapa')?.value.trim();
        const paginas = parseInt(document.getElementById('numLivroForaPaginas')?.value, 10) || 100;

        if (!titulo) {
            alert('Informe o título do livro.');
            return;
        }

        dadosAtualizacao = {
            livro_atual_id: null,
            livro_externo_titulo: titulo,
            livro_externo_capa: capa,
            livro_externo_paginas: paginas
        };
    }

    try {
        const { data: chatAtualizado, error } = await supabaseClient
            .from('chats_grupos')
            .update(dadosAtualizacao)
            .eq('id', chatAtivoSelecionado.id)
            .select('*')
            .single();

        if (error) throw error;

        if (chatAtualizado) {
            chatAtivoSelecionado = chatAtualizado;
            const idx = listaChatsUsuario.findIndex(c => Number(c.id) === Number(chatAtualizado.id));
            if (idx !== -1) {
                listaChatsUsuario[idx] = chatAtualizado;
            }
        }

        fecharModal('modalSelecionarLivroChat');
        await renderizarPainelChatAtivo();
        alert('Livro definido com sucesso!');
    } catch (err) {
        console.error('Erro ao salvar livro:', err);
        alert('Erro ao salvar livro: ' + (err.message || 'Falha na atualização.'));
    }
}

// ==========================================
// SALVAR PROGRESSO
// ==========================================

async function atualizarMeuProgresso(total) {
    const pagInput = document.getElementById('inputMinhaPagina');
    if (!pagInput || !chatAtivoSelecionado || !usuarioAtual) return;

    let novaPag = parseInt(pagInput.value, 10) || 0;
    const totalNumerico = parseInt(total, 10) || 100;
    novaPag = Math.max(0, Math.min(novaPag, totalNumerico));

    try {
        const payload = {
            chat_id: Number(chatAtivoSelecionado.id),
            usuario_id: Number(usuarioAtual.id),
            pagina_atual: novaPag,
            total_paginas: totalNumerico,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabaseClient
            .from('progresso_leitura')
            .upsert([payload], { onConflict: 'chat_id,usuario_id' });

        if (error) {
            console.error('Erro Supabase ao salvar progresso:', error);
            alert('Erro ao salvar progresso: ' + error.message);
            return;
        }

        await renderizarPainelChatAtivo();
    } catch (err) {
        console.error('Falha ao atualizar progresso:', err);
        alert('Erro ao atualizar progresso de leitura.');
    }
}

// ==========================================
// MENSAGENS E ENVIO
// ==========================================

function adicionarMensagemNaTela(msg) {
    const boxMsgs = document.getElementById('boxMensagensChat');
    if (!boxMsgs) return;

    const isMine = usuarioAtual && Number(msg.usuario_id) === Number(usuarioAtual.id);
    const hora = new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const msgDiv = document.createElement('div');
    msgDiv.style.cssText = `
        max-width: 70%;
        align-self: ${isMine ? 'flex-end' : 'flex-start'};
        background: ${isMine ? 'var(--primary-color)' : 'var(--bg-tertiary)'};
        color: ${isMine ? '#fff' : 'var(--text-main)'};
        padding: 10px 14px;
        border-radius: 10px;
        font-size: 0.88rem;
        word-break: break-word;
        box-shadow: 0 2px 4px rgba(0,0,0,0.15);
    `;

    msgDiv.innerHTML = `
        <div style="font-size:0.72rem; opacity:0.8; margin-bottom:4px; font-weight:600;">
            ${isMine ? 'Você' : escaparHTML(msg.nome_usuario || 'Usuário')} • ${hora}
        </div>
        <div>${escaparHTML(msg.texto)}</div>
    `;

    boxMsgs.appendChild(msgDiv);
    rolarChatParaFim();
}

async function enviarMensagemChat() {
    const input = document.getElementById('txtMensagemChat');
    if (!input || !chatAtivoSelecionado || !usuarioAtual || !usuarioAtual.id) return;

    const texto = input.value.trim();
    if (!texto) return;

    const novaMensagemObj = {
        chat_id: chatAtivoSelecionado.id,
        usuario_id: usuarioAtual.id,
        nome_usuario: usuarioAtual.nome,
        texto: texto,
        created_at: new Date().toISOString()
    };

    adicionarMensagemNaTela(novaMensagemObj);
    input.value = '';

    try {
        const { error } = await supabaseClient
            .from('chat_mensagens')
            .insert([{
                chat_id: novaMensagemObj.chat_id,
                usuario_id: novaMensagemObj.usuario_id,
                nome_usuario: novaMensagemObj.nome_usuario,
                texto: novaMensagemObj.texto
            }]);

        if (error) throw error;
    } catch (err) {
        console.error('Erro ao enviar mensagem:', err);
        alert('Erro ao enviar mensagem: ' + (err.message || 'Falha na conexão.'));
    } finally {
        input.focus();
    }
}

function rolarChatParaFim() {
    const box = document.getElementById('boxMensagensChat');
    if (box) {
        box.scrollTop = box.scrollHeight;
    }
}

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
        await supabaseClient.from('chat_membros').insert(registrosMembros);

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
    document.getElementById('btnAbaAcervoChat').className = origem === 'acervo' ? 'btn btn-primary' : 'btn btn-outline';
    document.getElementById('btnAbaForaChat').className = origem === 'fora' ? 'btn btn-primary' : 'btn btn-outline';
    document.getElementById('boxLivroAcervoChat').style.display = origem === 'acervo' ? 'block' : 'none';
    document.getElementById('boxLivroForaChat').style.display = origem === 'fora' ? 'block' : 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    try {
        if (typeof atualizarInterfacePermissoes === 'function') atualizarInterfacePermissoes();
        if (typeof carregarAcervo === 'function') carregarAcervo();
        if (typeof carregarUsuarios === 'function') {
            carregarUsuarios().then(() => carregarPerfilUsuario());
        } else {
            carregarPerfilUsuario();
        }
        inicializarEscutaRealtimeMensagens();
    } catch (err) {
        console.error('Erro na inicialização:', err);
    }
});

async function carregarPerfilUsuario() {
    // 1. Atualiza lista de conversas ativas no chat
    await carregarListaChats();

    const divPerfil = document.getElementById('tab-perfil');
    if (!divPerfil) return;

    if (!usuarioAtual || !usuarioAtual.id || usuarioAtual.nome === 'Visitante (Público)') {
        return;
    }

    // 2. Renderizar Favoritos do Usuário Logado
    const containerFavoritos = document.getElementById('meusFavoritosContainer');
    if (containerFavoritos) {
        if (!Array.isArray(listaFavoritos)) listaFavoritos = [];
        const meusFavs = listaFavoritos.filter(f => Number(f.usuario_id) === Number(usuarioAtual.id));

        if (meusFavs.length === 0) {
            containerFavoritos.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem;">Você ainda não possui livros favoritados.</p>';
        } else {
            containerFavoritos.innerHTML = '';
            meusFavs.forEach(fav => {
                const livro = (acervoCompleto || []).find(l => Number(l.id) === Number(fav.livro_id));
                if (livro) {
                    containerFavoritos.innerHTML += `
                        <div style="padding:8px 12px; background:var(--bg-tertiary); border-radius:6px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-size:0.88rem; font-weight:500;">${escaparHTML(livro.titulo_principal || livro.tituloPrincipal)}</span>
                            <button class="btn btn-danger" style="padding:2px 8px; font-size:0.75rem;" onclick="alternarFavorito(${livro.id})">
                                <i class="fa-solid fa-trash"></i> Remover
                            </button>
                        </div>
                    `;
                }
            });
        }
    }

    // 3. Renderizar Minhas Reservas / Pedidos
    const containerReservas = document.getElementById('minhasReservasContainer');
    if (containerReservas) {
        if (!Array.isArray(listaReservas)) listaReservas = [];
        const minhasRes = listaReservas.filter(r => Number(r.usuario_id) === Number(usuarioAtual.id));

        if (minhasRes.length === 0) {
            containerReservas.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem;">Nenhuma reserva realizada.</p>';
        } else {
            containerReservas.innerHTML = '';
            minhasRes.forEach(res => {
                const livro = (acervoCompleto || []).find(l => Number(l.id) === Number(res.livro_id));
                const dataFmt = res.data_reserva ? new Date(res.data_reserva).toLocaleDateString('pt-BR') : '-';
                containerReservas.innerHTML += `
                    <div style="padding:8px 12px; background:var(--bg-tertiary); border-radius:6px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <strong style="font-size:0.88rem;">${escaparHTML(livro ? (livro.titulo_principal || livro.tituloPrincipal) : 'Livro Removido')}</strong>
                            <div style="font-size:0.75rem; color:var(--text-muted);">Data: ${dataFmt} | Status: <strong>${res.status}</strong></div>
                        </div>
                        ${res.status === 'Pendente' ? `
                            <button class="btn btn-danger" style="padding:2px 8px; font-size:0.75rem;" onclick="cancelarReserva(${res.id})">
                                Cancelar
                            </button>
                        ` : ''}
                    </div>
                `;
            });
        }
    }
}