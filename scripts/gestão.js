// ==========================================
// 7. GESTÃO DE USUÁRIOS
// ==========================================

async function carregarUsuarios() {
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        try {
            const { data, error } = await supabaseClient.from('usuarios_sistema').select('*').order('id', { ascending: true });
            if (!error && data) listaUsuarios = data;
        } catch (err) { 
            console.warn("Erro ao buscar usuários", err); 
        }
    }
    renderizarTabelaUsuarios();
}

function renderizarTabelaUsuarios() {
    const tbody = document.getElementById('tbUsuarios');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!Array.isArray(listaUsuarios) || listaUsuarios.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Nenhum usuário cadastrado.</td></tr>`;
        return;
    }

    listaUsuarios.forEach(u => {
        const cargoLower = (u.cargo || 'usuario').toLowerCase();
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${u.nome || '-'}</strong></td>
            <td>${u.usuario || '-'}</td>
            <td>${u.email || '-'}</td>
            <td>${u.telefone || '-'}</td>
            <td><span class="role-badge role-${cargoLower}">${cargoLower.toUpperCase()}</span></td>
            <td>${u.departamento || '-'}</td>
            <td>
                <button class="btn btn-danger" style="padding:2px 6px; font-size:0.75rem;" onclick="excluirUsuario(${u.id})"><i class="fa-solid fa-user-minus"></i> Excluir</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function cadastrarUsuario(e) {
    if (e) e.preventDefault();

    const novoUsuario = {
        nome: document.getElementById('usrNome')?.value.trim() || '',
        usuario: document.getElementById('usrUsuario')?.value.trim() || '',
        email: document.getElementById('usrEmail')?.value.trim() || '',
        senha: document.getElementById('usrSenha')?.value.trim() || '',
        telefone: document.getElementById('usrTelefone')?.value.trim() || '',
        cargo: document.getElementById('usrCargo')?.value || 'usuario',
        departamento: document.getElementById('usrDepartamento')?.value.trim() || ''
    };

    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        const { error } = await supabaseClient.from('usuarios_sistema').insert([novoUsuario]);
        if (error) {
            alert('Erro ao cadastrar usuário no Supabase: ' + error.message);
            return;
        }
    }

    alert('Usuário cadastrado com sucesso!');
    const form = document.getElementById('formUsuario');
    if (form) form.reset();
    carregarUsuarios();
}

async function excluirUsuario(id) {
    if (confirm('Deseja realmente excluir este usuário do sistema?')) {
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            await supabaseClient.from('usuarios_sistema').delete().eq('id', id);
        }
        alert('Usuário removido.');
        carregarUsuarios();
    }
}

// ==========================================
// 8. CIRCULAÇÃO E EMPRÉSTIMOS
// ==========================================
async function carregarEmprestimos() {
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        try {
            const { data, error } = await supabaseClient.from('emprestimos').select('*').eq('status', 'Ativo');
            if (!error && data) listaEmprestimos = data;
        } catch (err) {
            console.warn("Erro ao buscar empréstimos", err);
        }
    }
    renderizarEmprestimos();
}

function populaSelectsEmprestimo() {
    const selLivro = document.getElementById('selectLivroEmprestimo');
    const selUsuario = document.getElementById('selectUsuarioEmprestimo');

    if (selLivro && Array.isArray(acervoCompleto)) {
        selLivro.innerHTML = '<option value="">Selecione um exemplar...</option>';
        acervoCompleto.filter(l => !l.em_lixeira).forEach(l => {
            selLivro.innerHTML += `<option value="${l.id}">${l.titulo_principal || l.tituloPrincipal}</option>`;
        });
    }

    if (selUsuario && Array.isArray(listaUsuarios)) {
        selUsuario.innerHTML = '<option value="">Selecione o usuário...</option>';
        listaUsuarios.forEach(u => {
            selUsuario.innerHTML += `<option value="${u.id}">${u.nome} (${u.email})</option>`;
        });
    }
}

async function registrarEmprestimo(e) {
    if (e) e.preventDefault();

    const livroId = document.getElementById('selectLivroEmprestimo')?.value;
    const usuarioId = document.getElementById('selectUsuarioEmprestimo')?.value;
    const dataDevolucao = document.getElementById('dataDevolucaoPrevista')?.value;

    if (!livroId || !usuarioId) {
        alert('Por favor, selecione um livro e um usuário.');
        return;
    }

    const novoEmp = {
        livro_id: Number(livroId),
        usuario_id: Number(usuarioId),
        data_emprestimo: new Date().toISOString(),
        data_devolucao_prevista: dataDevolucao || null,
        status: 'Ativo'
    };

    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        const { error } = await supabaseClient.from('emprestimos').insert([novoEmp]);
        if (error) {
            alert('Erro ao registrar empréstimo: ' + error.message);
            return;
        }
    }

    alert('Empréstimo registrado com sucesso!');
    const form = document.getElementById('formEmprestimo');
    if (form) form.reset();
    carregarEmprestimos();
}

function renderizarEmprestimos() {
    const tbody = document.getElementById('tabelaEmprestimosBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!Array.isArray(listaEmprestimos) || listaEmprestimos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nenhum empréstimo registrado.</td></tr>';
        return;
    }

    listaEmprestimos.forEach(emp => {
        const livro = Array.isArray(acervoCompleto) ? acervoCompleto.find(l => Number(l.id) === Number(emp.livro_id)) : null;
        const usr = Array.isArray(listaUsuarios) ? listaUsuarios.find(u => Number(u.id) === Number(emp.usuario_id)) : null;
        const dataFmt = emp.data_devolucao_prevista ? new Date(emp.data_devolucao_prevista).toLocaleDateString('pt-BR') : '-';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${livro ? (livro.titulo_principal || livro.tituloPrincipal) : 'Obra Desconhecida'}</strong></td>
            <td>${usr ? usr.nome : 'Usuário'}</td>
            <td>${dataFmt}</td>
            <td>
                <button class="btn btn-primary" style="padding:2px 6px; font-size:0.75rem;" onclick="devolverEmprestimo(${emp.id})"><i class="fa-solid fa-rotate-left"></i> Devolver</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function devolverEmprestimo(id) {
    if (confirm('Confirmar devolução do livro?')) {
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            await supabaseClient.from('emprestimos').update({ status: 'Devolvido' }).eq('id', id);
        }
        alert('Devolução concluída!');
        carregarEmprestimos();
    }
}

// ==========================================
// 9. RESERVAS, FAVORITOS E RESENHAS
// ==========================================
async function carregarReservas() {
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        try {
            const { data, error } = await supabaseClient.from('reservas').select('*').order('id', { ascending: false });
            if (!error && data) listaReservas = data;
        } catch (err) {
            console.warn("Erro ao carregar reservas", err);
        }
    }
    renderizarGestaoReservas();
}

async function solicitarReserva(livroId) {
    if (typeof usuarioAtual === 'undefined' || !usuarioAtual || usuarioAtual.nome === 'Visitante (Público)' || !usuarioAtual.id) {
        alert('É necessário fazer login para reservar um livro.');
        if (typeof abrirModalLogin === 'function') abrirModalLogin();
        return;
    }

    const numLivroId = Number(livroId);
    const numUsuarioId = Number(usuarioAtual.id);

    if (!Array.isArray(listaReservas)) listaReservas = [];

    const jaReservado = listaReservas.some(r => Number(r.livro_id) === numLivroId && Number(r.usuario_id) === numUsuarioId && r.status === 'Pendente');
    if (jaReservado) {
        alert('Você já possui uma solicitação de reserva pendente para este livro.');
        return;
    }

    const novaReserva = {
        livro_id: numLivroId,
        usuario_id: numUsuarioId,
        data_reserva: new Date().toISOString(),
        status: 'Pendente'
    };

    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        try {
            const { data, error } = await supabaseClient.from('reservas').insert([novaReserva]).select();
            if (error) throw error;
            if (data && data.length > 0) novaReserva.id = data[0].id;
        } catch (err) {
            console.error("Erro ao salvar reserva no Supabase", err);
            alert("Erro ao realizar reserva: " + (err.message || 'Falha na conexão.'));
            return;
        }
    }

    if (!novaReserva.id) novaReserva.id = Date.now();
    listaReservas.push(novaReserva);

    alert('Livro reservado com sucesso!');
    await carregarReservas();

    const tabPerfil = document.getElementById('tab-perfil');
    if (tabPerfil && tabPerfil.classList.contains('active') && typeof carregarPerfilUsuario === 'function') {
        carregarPerfilUsuario();
    }
}

function renderizarGestaoReservas() {
    const tbody = document.getElementById('tbGestaoReservasBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!Array.isArray(listaReservas)) listaReservas = [];

    const pendentes = listaReservas.filter(r => r.status === 'Pendente');
    if (pendentes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Nenhuma reserva pendente.</td></tr>`;
        return;
    }

    pendentes.forEach(res => {
        const livro = Array.isArray(acervoCompleto) ? acervoCompleto.find(l => Number(l.id) === Number(res.livro_id)) : null;
        const usr = Array.isArray(listaUsuarios) ? listaUsuarios.find(u => Number(u.id) === Number(res.usuario_id)) : null;
        const nomeUsuario = usr ? usr.nome : 'Leitor';
        const dataFormatada = res.data_reserva ? new Date(res.data_reserva).toLocaleDateString('pt-BR') : '-';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${livro ? (livro.titulo_principal || livro.tituloPrincipal) : 'Obra Removida'}</strong></td>
            <td>${nomeUsuario}</td>
            <td>${dataFormatada}</td>
            <td><span class="role-badge role-usuario">${res.status}</span></td>
            <td>
                <button class="btn btn-primary" style="padding:2px 6px; font-size:0.75rem;" onclick="atenderReserva(${res.id})"><i class="fa-solid fa-check"></i> Atender</button>
                <button class="btn btn-danger" style="padding:2px 6px; font-size:0.75rem; margin-left:4px;" onclick="cancelarReserva(${res.id})"><i class="fa-solid fa-xmark"></i> Cancelar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function atenderReserva(reservaId) {
    if (confirm('Marcar esta reserva como concluída?')) {
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try { await supabaseClient.from('reservas').update({ status: 'Concluida' }).eq('id', reservaId); } catch (e) {}
        }
        await carregarReservas();
    }
}

async function cancelarReserva(reservaId) {
    if (confirm('Deseja cancelar esta reserva?')) {
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try { await supabaseClient.from('reservas').update({ status: 'Cancelada' }).eq('id', reservaId); } catch (e) {}
        }
        await carregarReservas();
        const tabPerfil = document.getElementById('tab-perfil');
        if (tabPerfil && tabPerfil.classList.contains('active') && typeof carregarPerfilUsuario === 'function') {
            carregarPerfilUsuario();
        }
    }
}

async function carregarFavoritos() {
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        try {
            const { data, error } = await supabaseClient.from('favoritos').select('*');
            if (!error && data) listaFavoritos = data;
        } catch (err) {
            console.warn("Erro ao carregar favoritos", err);
        }
    }
}

async function alternarFavorito(livroId) {
    if (typeof usuarioAtual === 'undefined' || !usuarioAtual || usuarioAtual.nome === 'Visitante (Público)' || !usuarioAtual.id) {
        alert('Faça login para favoritar livros.');
        if (typeof abrirModalLogin === 'function') abrirModalLogin();
        return;
    }

    const numLivroId = Number(livroId);
    const numUsuarioId = Number(usuarioAtual.id);

    if (!Array.isArray(listaFavoritos)) listaFavoritos = [];

    const index = listaFavoritos.findIndex(f => Number(f.livro_id) === numLivroId && Number(f.usuario_id) === numUsuarioId);

    if (index >= 0) {
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            await supabaseClient.from('favoritos').delete().eq('usuario_id', numUsuarioId).eq('livro_id', numLivroId);
        }
        listaFavoritos.splice(index, 1);
        alert('Livro removido dos favoritos.');
    } else {
        const favorito = { usuario_id: numUsuarioId, livro_id: numLivroId };
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            const { error } = await supabaseClient.from('favoritos').insert([favorito]);
            if (error) {
                alert('Erro ao salvar favorito: ' + error.message);
                return;
            }
        }
        listaFavoritos.push(favorito);
        alert('Livro adicionado aos favoritos!');
    }

    if (typeof carregarAcervo === 'function') carregarAcervo();
    const tabPerfil = document.getElementById('tab-perfil');
    if (tabPerfil && tabPerfil.classList.contains('active') && typeof carregarPerfilUsuario === 'function') {
        carregarPerfilUsuario();
    }
}

async function carregarResenhas() {
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        try {
            const { data, error } = await supabaseClient.from('resenhas').select('*').order('id', { ascending: false });
            if (!error && data) listaResenhas = data;
        } catch (e) {
            console.warn("Erro ao carregar resenhas", e);
        }
    }
}

async function publicarResenha() {
    if (typeof usuarioAtual === 'undefined' || !usuarioAtual || usuarioAtual.nome === 'Visitante (Público)' || !usuarioAtual.id) {
        alert('Faça login para escrever resenhas.');
        if (typeof abrirModalLogin === 'function') abrirModalLogin();
        return;
    }

    if (typeof livroCIPSelecionado === 'undefined' || !livroCIPSelecionado) return;

    const notaElem = document.getElementById('resenhaNota');
    const textoElem = document.getElementById('resenhaTexto');

    const nota = notaElem ? parseInt(notaElem.value, 10) || 5 : 5;
    const texto = textoElem ? textoElem.value.trim() : '';

    if (!texto) {
        alert('Por favor, escreva um comentário antes de publicar.');
        return;
    }

    const novaResenha = {
        livro_id: Number(livroCIPSelecionado.id),
        usuario_id: Number(usuarioAtual.id),
        nome_usuario: usuarioAtual.nome,
        nota: nota,
        comentario: texto,
        data_resenha: new Date().toISOString(),
        status: 'pendente'
    };

    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        const { data, error } = await supabaseClient.from('resenhas').insert([novaResenha]).select();
        if (error) {
            alert("Erro ao salvar resenha: " + error.message);
            return;
        }
        if (data && data.length > 0) novaResenha.id = data[0].id;
    }

    if (!novaResenha.id) novaResenha.id = Date.now();
    if (!Array.isArray(listaResenhas)) listaResenhas = [];
    listaResenhas.unshift(novaResenha);

    if (textoElem) textoElem.value = '';
    alert('Sua resenha foi enviada com sucesso e aguarda aprovação!');
    exibirResenhasModal(livroCIPSelecionado.id);
}

function exibirResenhasModal(livroId) {
    const container = document.getElementById('containerResenhasLivro');
    if (!container) return;
    container.innerHTML = '';

    const isEquipe = typeof usuarioAtual !== 'undefined' && usuarioAtual && (usuarioAtual.cargo === 'bibliotecario' || usuarioAtual.cargo === 'estagiario');

    if (!Array.isArray(listaResenhas)) listaResenhas = [];

    const resenhasLivro = listaResenhas.filter(r => {
        if (Number(r.livro_id) !== Number(livroId)) return false;
        const status = r.status || 'aprovada';
        return status === 'aprovada' || isEquipe || (usuarioAtual && Number(r.usuario_id) === Number(usuarioAtual.id));
    });

    if (resenhasLivro.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem;">Seja o primeiro leitor a publicar uma resenha para esta obra!</p>';
        return;
    }

    resenhasLivro.forEach(r => {
        const estrelas = '⭐'.repeat(r.nota || 5);
        const dataFmt = new Date(r.data_resenha || Date.now()).toLocaleDateString('pt-BR');
        const status = r.status || 'aprovada';

        let badgeStatus = '';
        if (status === 'pendente') {
            badgeStatus = '<span class="role-badge role-estagiario" style="margin-left:6px;">Em Análise</span>';
        } else if (status === 'rejeitada') {
            badgeStatus = '<span class="role-badge" style="background:rgba(248,113,113,0.2); color:var(--accent-red); margin-left:6px;">Rejeitada</span>';
        }

        let acoesEquipe = '';
        if (isEquipe && status === 'pendente') {
            acoesEquipe = `
                <div style="margin-top:8px; display:flex; gap:6px;">
                    <button class="btn btn-primary" style="padding:2px 8px; font-size:0.75rem;" onclick="aprovarResenha(${r.id})"><i class="fa-solid fa-check"></i> Aprovar</button>
                    <button class="btn btn-danger" style="padding:2px 8px; font-size:0.75rem;" onclick="rejeitarResenha(${r.id})"><i class="fa-solid fa-xmark"></i> Rejeitar</button>
                </div>
            `;
        }

        container.innerHTML += `
            <div style="background: var(--bg-card); border: 1px solid var(--border-color); padding: 8px 12px; border-radius: 6px; margin-bottom: 8px;">
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; margin-bottom:4px;">
                    <div>
                        <strong>${r.nome_usuario || 'Leitor Anônimo'}</strong>
                        ${badgeStatus}
                    </div>
                    <span style="color:var(--text-muted);">${dataFmt}</span>
                </div>
                <div style="font-size:0.8rem; color:#f59e0b; margin-bottom:4px;">${estrelas}</div>
                <div style="font-size:0.85rem;">"${r.comentario || ''}"</div>
                ${acoesEquipe}
            </div>
        `;
    });
}

async function aprovarResenha(id) {
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        try { await supabaseClient.from('resenhas').update({ status: 'aprovada' }).eq('id', id); } catch (e) {}
    }
    await carregarResenhas();
    alert('Resenha aprovada com sucesso!');
}

async function rejeitarResenha(id) {
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        try { await supabaseClient.from('resenhas').update({ status: 'rejeitada' }).eq('id', id); } catch (e) {}
    }
    await carregarResenhas();
    alert('Resenha rejeitada.');
}