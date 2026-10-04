// ==========================================
// 1. CONFIGURAÇÃO E CLIENTE SUPABASE
// ==========================================
const supabaseUrl = 'https://bjjlaswencdaibwyzvhh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqamxhc3dlbmNkYWlid3l6dmhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNjM4MTEsImV4cCI6MjEwNjYzOTgxMX0.vWF_yZCJQThL1GUfvrcEpY_adI8N0DwXzPAnhjzX2Vo';

let supabaseClient = null;
if (window.supabase && typeof window.supabase.createClient === 'function') {
    supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
}

// Disponibiliza o cliente também no objeto window para compatibilidade
// com módulos que acessam o Supabase por window.supabaseClient.
window.supabaseClient = supabaseClient;

// ESTADO GLOBAL
let usuarioAtual = JSON.parse(localStorage.getItem('sessao_biblioteca')) || {
    id: 0,
    nome: 'Visitante (Público)',
    cargo: 'usuario'
};

let acervoCompleto = [];
let listaUsuarios = [];
let listaEmprestimos = [];
let listaReservas = [];
let listaFavoritos = [];
let listaResenhas = [];

let livroCIPSelecionado = null;

// ==========================================
// 2. INICIALIZAÇÃO DA PÁGINA
// ==========================================
window.onload = function () {
    atualizarInterfacePermissoes();
    carregarAcervo();
    carregarUsuarios();
    carregarEmprestimos();
    carregarReservas();
    carregarResenhas();
    carregarFavoritos();
    alternarCamposPorTipoMaterial();
};

// ==========================================
// 3. GERENCIAMENTO DE PERMISSÕES E INTERFACE
// ==========================================
function atualizarInterfacePermissoes() {
    const lblName = document.getElementById('lblUserName');
    const badge = document.getElementById('lblUserRole');

    if (lblName) lblName.innerText = usuarioAtual.nome;

    const cargo = (usuarioAtual.cargo || 'usuario').toLowerCase();
    if (badge) {
        badge.innerText = cargo.toUpperCase();
        badge.className = `role-badge role-${cargo}`;
    }

    const isLogado = usuarioAtual.nome !== 'Visitante (Público)';
    const isEstagiarioOuAdmin = (cargo === 'bibliotecario' || cargo === 'estagiario');
    const isAdmin = (cargo === 'bibliotecario');

    const btnLoginHeader = document.getElementById('btnHeaderLogin');
    if (btnLoginHeader) {
        if (!isLogado) {
            btnLoginHeader.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar / Login';
            btnLoginHeader.onclick = abrirModalLogin;
        } else {
            btnLoginHeader.innerHTML = `<i class="fa-solid fa-right-from-bracket"></i> Sair (${usuarioAtual.nome.split(' ')[0]})`;
            btnLoginHeader.onclick = fazerLogout;
        }
    }

    const tabPerfil = document.getElementById('tabNavPerfil');
    const tabCirculacao = document.getElementById('tabNavCirculacao');
    const tabCatalogacao = document.getElementById('tabNavCatalogacao');
    const tabUsuarios = document.getElementById('tabNavUsuarios');
    const tabLixeira = document.getElementById('tabNavLixeira');

    if (tabPerfil) tabPerfil.style.display = isLogado ? 'flex' : 'none';
    if (tabCirculacao) tabCirculacao.style.display = isEstagiarioOuAdmin ? 'flex' : 'none';
    if (tabCatalogacao) tabCatalogacao.style.display = isEstagiarioOuAdmin ? 'flex' : 'none';
    if (tabUsuarios) tabUsuarios.style.display = isAdmin ? 'flex' : 'none';
    if (tabLixeira) tabLixeira.style.display = isAdmin ? 'flex' : 'none';

    const lockCat = document.getElementById('lockCatalogacao');
    const contentCat = document.getElementById('contentCatalogacao');
    if (lockCat) lockCat.style.display = isEstagiarioOuAdmin ? 'none' : 'block';
    if (contentCat) contentCat.style.display = isEstagiarioOuAdmin ? 'block' : 'none';

    const lockUsr = document.getElementById('lockUsuarios');
    const contentUsr = document.getElementById('contentUsuarios');
    if (lockUsr) lockUsr.style.display = isAdmin ? 'none' : 'block';
    if (contentUsr) contentUsr.style.display = isAdmin ? 'block' : 'none';

    const lockLix = document.getElementById('lockLixeira');
    const contentLix = document.getElementById('contentLixeira');
    if (lockLix) lockLix.style.display = isAdmin ? 'none' : 'block';
    if (contentLix) contentLix.style.display = isAdmin ? 'block' : 'none';
}

// ==========================================
// NAVEGAÇÃO ENTRE ABAS
// ==========================================
function trocarAba(abaId) {
    const abas = document.querySelectorAll('.tab-content, .tab-pane');
    const botoes = document.querySelectorAll('.nav-tab, .tab-button');

    abas.forEach(aba => {
        aba.classList.remove('active');
        if (aba.id === `tab-${abaId}` || aba.id === abaId) {
            aba.classList.add('active');
        }
    });

    botoes.forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-tab') === abaId || btn.getAttribute('onclick')?.includes(abaId)) {
            btn.classList.add('active');
        }
    });

    // Atualiza listagens de acordo com a aba ativada
    if (abaId === 'perfil' && typeof carregarPerfilUsuario === 'function') {
        carregarPerfilUsuario();
    } else if (abaId === 'circulacao') {
        if (typeof populaSelectsEmprestimo === 'function') populaSelectsEmprestimo();
        if (typeof carregarEmprestimos === 'function') carregarEmprestimos();
        if (typeof carregarReservas === 'function') carregarReservas();
    } else if (abaId === 'lixeira' && typeof renderizarLixeira === 'function') {
        renderizarLixeira();
    }
}

// ==========================================
// 4. AUTENTICAÇÃO E LOGIN
// ==========================================
function abrirModalLogin() {
    const modal = document.getElementById('modalLogin');
    if (modal) modal.classList.add('active');
}

function fecharModalLogin() {
    const modal = document.getElementById('modalLogin');
    if (modal) modal.classList.remove('active');
}

async function realizarLogin(e) {
    if (e) e.preventDefault();
    const loginInput = document.getElementById('loginEmail').value.trim();
    const senhaInput = document.getElementById('loginSenha').value.trim();

    if (!loginInput || !senhaInput) {
        alert('Por favor, preencha as credenciais.');
        return;
    }

    if (supabaseClient) {
        try {
            const { data, error } = await supabaseClient
                .from('usuarios_sistema')
                .select('*')
                .or(`email.eq.${loginInput},usuario.eq.${loginInput},nome.eq.${loginInput}`)
                .eq('senha', senhaInput);

            if (!error && data && data.length > 0) {
                const userObj = data[0];
                usuarioAtual = {
                    id: userObj.id,
                    nome: userObj.nome,
                    usuario: userObj.usuario || userObj.nome,
                    email: userObj.email,
                    telefone: userObj.telefone || '',
                    cargo: userObj.cargo || 'usuario',
                    departamento: userObj.departamento || ''
                };
                finalizarLoginSucesso();
                return;
            }
        } catch (err) {
            console.warn("Autenticação via Supabase falhou, verificando localmente.", err);
        }
    }

    const localUser = listaUsuarios.find(u => 
        (u.email === loginInput || u.usuario === loginInput || u.nome === loginInput) && u.senha === senhaInput
    );
    if (localUser) {
        usuarioAtual = localUser;
        finalizarLoginSucesso();
    } else {
        alert('Usuário ou senha incorretos.');
    }
}

function finalizarLoginSucesso() {
    localStorage.setItem('sessao_biblioteca', JSON.stringify(usuarioAtual));
    alert(`Bem-vindo(a), ${usuarioAtual.nome}!`);
    window.location.reload();
}

function entrarComoVisitante() {
    usuarioAtual = { id: 0, nome: 'Visitante (Público)', cargo: 'usuario' };
    localStorage.removeItem('sessao_biblioteca');
    window.location.reload();
}

function fazerLogout() {
    if (confirm('Deseja realmente encerrar a sessão atual?')) {
        localStorage.removeItem('sessao_biblioteca');
        window.location.reload();
    }
}

// ==========================================
// 6. CONSULTA E EXIBIÇÃO DO ACERVO
// ==========================================
async function carregarAcervo() {
    let dados = [];

    if (supabaseClient) {
        try {
            const { data, error } = await supabaseClient
                .from('acervo')
                .select('*')
                .order('id', { ascending: false });

            if (!error && data) dados = data;
        } catch (err) {
            console.warn("Falha ao buscar no Supabase.", err);
        }
    }

    if (dados.length === 0) {
        const salvos = localStorage.getItem('bibliotecaRegistros');
        if (salvos) dados = JSON.parse(salvos);
    }

    acervoCompleto = dados;
    const acervoAtivo = acervoCompleto.filter(l => !l.em_lixeira);
    renderizarTabelaAcervo(acervoAtivo);
    renderizarCarrosseis(acervoAtivo);
    renderizarLixeira();
    populaSelectsEmprestimo();
}

function renderizarTabelaAcervo(lista) {
    const container = document.getElementById('visaoListaAcervo');
    if (!container) return;
    container.innerHTML = '';

    if (lista.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 30px; color: var(--text-muted); width: 100%;">Nenhum registro encontrado no acervo ativo.</div>`;
        return;
    }

    const isEstagiarioOuAdmin = (usuarioAtual.cargo === 'bibliotecario' || usuarioAtual.cargo === 'estagiario');
    const isAdmin = (usuarioAtual.cargo === 'bibliotecario');

    lista.forEach((livro, index) => {
        const itemRow = document.createElement('div');
        itemRow.className = 'acervo-item-row';

        const capaSrc = livro.capa_url || livro.capaUrl;
        const capaHtml = (capaSrc && capaSrc.trim() !== '')
            ? `<img src="${capaSrc}" alt="${livro.titulo_principal || 'Capa'}" class="acervo-cover-img" onerror="this.onerror=null; this.parentNode.innerHTML='<div class=\\'acervo-cover-placeholder\\'><i class=\\'fa-solid fa-book-bookmark\\'></i><span>Malo</span></div>';">`
            : `<div class="acervo-cover-placeholder"><i class="fa-solid fa-book-bookmark"></i></div>`;

        const isFavorito = listaFavoritos.some(f => f.livro_id == livro.id && f.usuario_id == usuarioAtual.id);
        const favIconClass = isFavorito ? "fa-solid fa-heart" : "fa-regular fa-heart";
        const favColor = isFavorito ? "color: var(--accent-red);" : "";

        const tomboDisplay = livro.numero_tombo || livro.tombo || `BIG-${livro.id}`;

        const btnEditar = isEstagiarioOuAdmin
            ? `<button class="acervo-btn-action" onclick="editarLivro(${livro.id})"><i class="fa-solid fa-pen-to-square"></i> Editar</button>`
            : '';

        const btnMoverLixeira = isAdmin 
            ? `<button class="acervo-btn-action" style="color:var(--accent-red);" onclick="moverParaLixeira(${livro.id})"><i class="fa-solid fa-trash-can"></i> Lixeira</button>`
            : '';

        itemRow.innerHTML = `
            <div class="acervo-item-number">${index + 1}.</div>
            <div class="acervo-card">
                <div class="acervo-cover">${capaHtml}</div>
                <div class="acervo-details">
                    <div class="acervo-title">"${livro.titulo_principal || livro.tituloPrincipal || 'Sem título'}"</div>
                    <div class="acervo-author">${livro.nome_pessoal || livro.nomePessoal || livro.autor_entidade || 'Autor não informado'}</div>
                    <div class="acervo-meta"><strong>Tipo:</strong> ${livro.tipo_material || 'Livros'} — <strong>Tombo:</strong> <span style="color:#38bdf8; font-weight:bold;">${tomboDisplay}</span></div>
                    <div class="acervo-meta"><strong>Localização (CDD/Cutter):</strong> <span class="acervo-location-code">${livro.classificacao_cdd || '000'} ${livro.codigo_autor_cutter || ''}</span> (${livro.codigo_livro || 'Sem Chamada'})</div>
                    <div class="acervo-meta"><strong>Publicação:</strong> ${livro.local_publicacao || 'Belém'} : ${livro.editora || 'Malo'}, ${livro.data_publicacao || '2026'}.</div>
                    <div class="acervo-meta"><strong>Assunto:</strong> ${livro.assunto || 'Trânsito'}</div>
                </div>

                <div class="acervo-actions">
                    <button class="acervo-btn-action" onclick="solicitarReserva(${livro.id})"><i class="fa-solid fa-bookmark"></i> Reservar</button>
                    <button class="acervo-btn-action" style="${favColor}" onclick="alternarFavorito(${livro.id})"><i class="${favIconClass}"></i> Favoritar</button>
                    <button class="acervo-btn-action" onclick="verCIP(${livro.id})"><i class="fa-solid fa-id-card"></i> CIP / Resenhas</button>
                    ${btnEditar}
                    ${btnMoverLixeira}
                </div>
            </div>
        `;
        container.appendChild(itemRow);
    });
}

function renderizarCarrosseis(lista) {
    const cPopulares = document.getElementById('populares');
    const cRecentes = document.getElementById('recemChegados');
    const cDoacao = document.getElementById('doacao');

    if (!cPopulares || !cRecentes || !cDoacao) return;

    cPopulares.innerHTML = '';
    cRecentes.innerHTML = '';
    cDoacao.innerHTML = '';

    if (lista.length === 0) {
        const msgVazia = '<div style="padding:15px; color:var(--text-muted);">Nenhuma obra cadastrada.</div>';
        cPopulares.innerHTML = msgVazia;
        cRecentes.innerHTML = msgVazia;
        cDoacao.innerHTML = msgVazia;
        return;
    }

    const doacoes = lista.filter(l => (l.tipo_aquisicao || '').toLowerCase().includes('doaç') || (l.tipo_aquisicao || '').toLowerCase().includes('doacao'));
    const listaDoacao = doacoes.length > 0 ? doacoes : lista;

    const criarCardCarrossel = (livro) => {
        const capaSrc = livro.capa_url || livro.capaUrl;
        const capaHtml = (capaSrc && capaSrc.trim() !== '')
            ? `<img src="${capaSrc}" alt="Capa" style="width:100%; height:160px; object-fit:cover; border-radius:6px; margin-bottom:8px;">`
            : `<div style="width:100%; height:160px; background:var(--bg-tertiary); display:flex; flex-direction:column; align-items:center; justify-content:center; border-radius:6px; margin-bottom:8px; color:var(--text-muted);"><i class="fa-solid fa-book" style="font-size:2rem; margin-bottom:4px;"></i><span style="font-size:0.75rem;">Malosystem</span></div>`;

        return `
            <div class="carrossel-card" style="min-width: 170px; max-width: 170px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    ${capaHtml}
                    <div style="font-weight: 600; font-size: 0.85rem; height: 38px; overflow: hidden; line-height: 1.2; margin-bottom: 4px;">${livro.titulo_principal || livro.tituloPrincipal}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${livro.nome_pessoal || livro.autor_entidade || 'Autor não informado'}</div>
                </div>
                <div style="margin-top:10px; display:flex; gap:4px;">
                    <button class="btn btn-primary" style="font-size: 0.7rem; padding: 4px; flex:1;" onclick="solicitarReserva(${livro.id})"><i class="fa-solid fa-bookmark"></i> Reservar</button>
                    <button class="btn btn-outline" style="font-size: 0.7rem; padding: 4px;" onclick="verCIP(${livro.id})"><i class="fa-solid fa-id-card"></i></button>
                </div>
            </div>
        `;
    };

    lista.forEach(livro => {
        cPopulares.innerHTML += criarCardCarrossel(livro);
        cRecentes.innerHTML += criarCardCarrossel(livro);
    });

    listaDoacao.forEach(livro => {
        cDoacao.innerHTML += criarCardCarrossel(livro);
    });
}

function filtrarAcervo() {
    const termo = document.getElementById('txtBusca').value.toLowerCase().trim();
    const acervoAtivo = acervoCompleto.filter(l => !l.em_lixeira);
    const filtrados = acervoAtivo.filter(l => {
        const tit = (l.titulo_principal || l.tituloPrincipal || '').toLowerCase();
        const aut = (l.nome_pessoal || l.nomePessoal || l.autor_entidade || '').toLowerCase();
        const ass = (l.assunto || '').toLowerCase();
        const isbn = (l.isbn || '').toLowerCase();
        const cdd = (l.classificacao_cdd || l.classificacao || '').toLowerCase();
        const tombo = (l.numero_tombo || l.tombo || '').toLowerCase();

        return tit.includes(termo) || aut.includes(termo) || ass.includes(termo) || isbn.includes(termo) || cdd.includes(termo) || tombo.includes(termo);
    });

    renderizarTabelaAcervo(filtrados);
    renderizarCarrosseis(filtrados);
}

function alternarVisaoAcervo(modo) {
    const visaoLista = document.getElementById('visaoListaAcervo');
    const visaoGrade = document.getElementById('visaoGradeAcervo');
    const btnLista = document.getElementById('btnVisaoLista');
    const btnGrade = document.getElementById('btnVisaoGrade');

    if (modo === 'grade') {
        visaoLista.style.display = 'none';
        visaoGrade.style.display = 'flex';
        btnLista.classList.remove('active');
        btnGrade.classList.add('active');
    } else {
        visaoLista.style.display = 'flex';
        visaoGrade.style.display = 'none';
        btnGrade.classList.remove('active');
        btnLista.classList.add('active');
    }
}

function rolarCarrossel(idCarrossel, deslocamento) {
    const container = document.getElementById(idCarrossel);
    if (container) {
        container.scrollBy({ left: deslocamento, behavior: 'smooth' });
    }
}

function renderizarFavoritos(listaFavoritos) {
    const container = document.getElementById('meusFavoritosContainer');
    
    if (!listaFavoritos || listaFavoritos.length === 0) {
        container.innerHTML = `<p style="color:var(--text-muted); padding:10px;">Nenhum livro favoritado.</p>`;
        return;
    }

    let html = '';
    listaFavoritos.forEach(livro => {
        // Define uma imagem padrão caso a capa esteja vazia ou nula
        let capaSrc = livro.capa_url && livro.capa_url.trim() !== '' 
            ? livro.capa_url 
            : 'caminho/para/capa-padrao.jpg'; // ou deixe um link de placeholder se preferir

        html += `
            <div class="favorite-item">
                <div class="book-info">
                    <img src="${capaSrc}" alt="Capa de ${livro.titulo_principal}" class="book-cover" onerror="this.src='https://via.placeholder.com/45x65?text=Sem+Capa'">
                    <div class="book-details">
                        <span class="book-title">${livro.titulo_principal || 'Título Desconhecido'}</span>
                        <span class="book-author" style="display:block; font-size:0.8rem; color:var(--text-muted);">${livro.nome_pessoal || livro.responsabilidade || 'Autor desconhecido'}</span>
                    </div>
                </div>
                <button class="btn-remove" onclick="removerFavorito('${livro.id || livro.numero_tombo}')">
                    <i class="fa-solid fa-trash"></i> Remover
                </button>
            </div>
        `;
    });

    container.innerHTML = html;
}