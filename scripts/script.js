// ==========================================
// 1. CONFIGURAÇÃO E CLIENTE SUPABASE
// ==========================================
const supabaseUrl = 'https://bjjlaswencdaibwyzvhh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqamxhc3dlbmNkYWlid3l6dmhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNjM4MTEsImV4cCI6MjEwNjYzOTgxMX0.vWF_yZCJQThL1GUfvrcEpY_adI8N0DwXzPAnhjzX2Vo';

let supabaseClient = null;
if (window.supabase && typeof window.supabase.createClient === 'function') {
    supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
}

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
const chamar = (fn, ...args) => (typeof window[fn] === 'function' ? window[fn](...args) : undefined);

function escaparHTML(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
}

function iniciarTema() {
    let salvo = null;
    try { salvo = localStorage.getItem('tema'); } catch (_) {}
    if (salvo) document.documentElement.dataset.theme = salvo;
    const painel = document.querySelector('.user-panel');
    if (!painel || document.getElementById('btnTema')) return;
    const btn = document.createElement('button');
    btn.id = 'btnTema'; btn.type = 'button'; btn.className = 'btn-switch-user'; btn.title = 'Alternar tema';
    btn.innerHTML = '<i class="fa-solid fa-circle-half-stroke"></i>';
    btn.onclick = () => {
        const atual = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        const novo = atual === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = novo;
        try { localStorage.setItem('tema', novo); } catch (_) {}
    };
    painel.appendChild(btn);
}

function garantirModaisLogin() {
    if (document.getElementById('modalLogin')) return;
    document.body.insertAdjacentHTML('beforeend', `
<div class="modal-overlay" id="modalLogin"><div class="modal-box"><span class="close-modal" onclick="fecharModalLogin()">&times;</span>
<h3><i class="fa-solid fa-user-lock"></i> Autenticação de Usuário</h3>
<form id="formLoginModal" onsubmit="realizarLogin(event)" class="form-grid" style="margin-top:12px">
<div class="form-group full-width"><label for="loginEmail">E-mail ou Usuário</label><input id="loginEmail" required autocomplete="username"></div>
<div class="form-group full-width"><label for="loginSenha">Senha</label><input type="password" id="loginSenha" required autocomplete="current-password"></div>
<div class="btn-group full-width" style="flex-direction:column"><button class="btn btn-primary" type="submit">Entrar</button>
<button type="button" class="btn btn-outline" onclick="entrarComoVisitante()">Continuar como Visitante</button>
<button type="button" class="btn btn-outline" onclick="abrirModalPreCadastro()">Não tem conta? Faça seu pré-registo</button></div></form></div></div>
<div class="modal-overlay" id="modalPreCadastro"><div class="modal-box"><span class="close-modal" onclick="fecharModalPreCadastro()">&times;</span>
<h3><i class="fa-solid fa-id-card"></i> Pré-registo Online</h3>
<form id="formPreCadastro" onsubmit="realizarPreCadastro(event)" class="form-grid" style="margin-top:12px">
<div class="form-group full-width"><label for="preNome">Nome Completo</label><input id="preNome" required></div>
<div class="form-group full-width"><label for="preUsuario">Nome de Usuário</label><input id="preUsuario" required></div>
<div class="form-group full-width"><label for="preEmail">E-mail</label><input type="email" id="preEmail" required></div>
<div class="form-group full-width"><label for="preSenha">Senha</label><input type="password" id="preSenha" required autocomplete="new-password"></div>
<button class="btn btn-primary full-width" type="submit">Concluir Pré-registo</button></form></div></div>`);
}

function init() {
    const cargo = (usuarioAtual.cargo || 'usuario').toLowerCase();
    const logado = usuarioAtual.nome !== 'Visitante (Público)';
    const exigido = document.body.dataset.acesso;
    const ok = !exigido || (exigido === 'logado' && logado) || (exigido === 'staff' && ['bibliotecario', 'estagiario'].includes(cargo)) || (exigido === 'admin' && cargo === 'bibliotecario');
    if (!ok) { location.replace('index.html'); return; }
    iniciarTema();
    garantirModaisLogin();
    atualizarInterfacePermissoes();
    window.appReady = Promise.all([carregarAcervo(), ...['carregarUsuarios', 'carregarEmprestimos', 'carregarReservas', 'carregarResenhas', 'carregarFavoritos'].map(f => chamar(f))])
        .then(() => { chamar('alternarCamposPorTipoMaterial'); chamar('populaSelectsEmprestimo'); filtrarAcervoAgora(); })
        .catch(e => console.error('Falha na inicialização:', e));
}
document.addEventListener('DOMContentLoaded', init);
document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active')); });
document.addEventListener('click', e => { if (e.target.classList?.contains('modal-overlay')) e.target.classList.remove('active'); });

// ==========================================
// 3. GERENCIAMENTO DE PERMISSÕES E INTERFACE
// ==========================================
function atualizarInterfacePermissoes() {
    const cargo = (usuarioAtual.cargo || 'usuario').toLowerCase();
    const isLogado = usuarioAtual.nome !== 'Visitante (Público)';
    const isEstagiarioOuAdmin = (cargo === 'bibliotecario' || cargo === 'estagiario');
    const isAdmin = (cargo === 'bibliotecario');

    const tabEtiquetas = document.getElementById('tabNavEtiquetas');
    if (tabEtiquetas) tabEtiquetas.style.display = isEstagiarioOuAdmin ? 'flex' : 'none';

    const lockEtq = document.getElementById('lockEtiquetas');
    const contentEtq = document.getElementById('contentEtiquetas');
    if (lockEtq) lockEtq.style.display = isEstagiarioOuAdmin ? 'none' : 'block';
    if (contentEtq) contentEtq.style.display = isEstagiarioOuAdmin ? 'block' : 'none';

    const lblName = document.getElementById('lblUserName');
    const badge = document.getElementById('lblUserRole');

    if (lblName) lblName.innerText = usuarioAtual.nome;

    if (badge) {
        badge.innerText = cargo.toUpperCase();
        badge.className = `role-badge role-${cargo}`;
    }

    const btnLoginHeader = document.getElementById('btnHeaderLogin');
    if (btnLoginHeader) {
        if (!isLogado) {
            btnLoginHeader.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar / Login';
            btnLoginHeader.onclick = abrirModalLogin;
        } else {
            btnLoginHeader.innerHTML = `<i class="fa-solid fa-right-from-bracket"></i> Sair (${escaparHTML(usuarioAtual.nome.split(' ')[0])})`;
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

function trocarAba(abaId) {
    const abas = document.querySelectorAll('.tab-content, .tab-pane');
    const botoes = document.querySelectorAll('.nav-tab, .tab-button');

    abas.forEach(aba => {
        aba.classList.remove('active');
        if (aba.id === `tab-${escaparHTML(abaId)}` || aba.id === abaId) {
            aba.classList.add('active');
        }
    });

    botoes.forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-tab') === abaId || btn.getAttribute('onclick')?.includes(abaId)) {
            btn.classList.add('active');
        }
    });

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
    const senhaInput = document.getElementById('loginSenha').value;
    const seguro = loginInput.replace(/[,()*]/g, '');

    if (!loginInput || !senhaInput) {
        alert('Por favor, preencha as credenciais.');
        return;
    }

    if (supabaseClient) {
        try {
            const { data, error } = await supabaseClient
                .from('usuarios_sistema')
                .select('*')
                .or(`email.eq.${seguro},usuario.eq.${seguro},nome.eq.${seguro}`)
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
        const { senha, ...semSenha } = localUser;
        usuarioAtual = semSenha;
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
    chamar('renderizarLixeira');
    chamar('populaSelectsEmprestimo');

    chamar('popularSelectEtiquetas');

    // CORREÇÃO: Verifica se veio parâmetro de edição na URL após carregar o acervo
    const urlParams = new URLSearchParams(window.location.search);
    const idEditar = urlParams.get('editar');
    if (idEditar) chamar('editarLivro', idEditar);
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
            ? `<img loading="lazy" src="${escaparHTML(capaSrc)}" alt="${escaparHTML(livro.titulo_principal || 'Capa')}" class="acervo-cover-img" onerror="this.onerror=null; this.parentNode.innerHTML='<div class=\\'acervo-cover-placeholder\\'><i class=\\'fa-solid fa-book-bookmark\\'></i></div>';">`
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
                    <div class="acervo-title">"${escaparHTML(livro.titulo_principal || livro.tituloPrincipal || 'Sem título')}"</div>
                    <div class="acervo-author">${escaparHTML(livro.nome_pessoal || livro.nomePessoal || livro.autor_entidade || 'Autor não informado')}</div>
                    <div class="acervo-meta"><strong>Tipo:</strong> ${escaparHTML(livro.tipo_material || 'Livros')} — <strong>Tombo:</strong> <span class="marc-code">${escaparHTML(tomboDisplay)}</span></div>
                    <div class="acervo-meta"><strong>Localização (CDD/Cutter):</strong> <span class="acervo-location-code">${escaparHTML(livro.classificacao_cdd || '000')} ${escaparHTML(livro.codigo_autor_cutter || '')}</span> (${escaparHTML(livro.codigo_livro || livro.numero_chamada_local || 'Sem Chamada')})</div>
                    <div class="acervo-meta"><strong>Publicação:</strong> ${escaparHTML(livro.local_publicacao || 's.l.')} : ${escaparHTML(livro.editora || 's.n.')}, ${escaparHTML(livro.data_publicacao || 's.d.')}.</div>
                    <div class="acervo-meta"><strong>Assunto:</strong> ${escaparHTML(livro.assunto || '—')}</div>
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

    const card = (l) => {
        const capa = l.capa_url || l.capaUrl;
        const img = capa ? `<img class="carrossel-cover" loading="lazy" src="${escaparHTML(capa)}" alt="">` : '<div class="carrossel-cover ph"><i class="fa-solid fa-book"></i></div>';
        return `<div class="carrossel-card"><div>${img}<div class="carrossel-title">${escaparHTML(l.titulo_principal || l.tituloPrincipal || 'Sem título')}</div><div class="carrossel-author">${escaparHTML(l.nome_pessoal || l.autor_entidade || 'Autor não informado')}</div></div><div class="carrossel-actions"><button class="btn btn-primary btn-sm" onclick="solicitarReserva(${l.id})"><i class="fa-solid fa-bookmark"></i> Reservar</button><button class="btn btn-outline btn-sm" title="CIP / Resenhas" onclick="verCIP(${l.id})"><i class="fa-solid fa-id-card"></i></button></div></div>`;
    };
    const favs = id => listaFavoritos.reduce((n, f) => n + (Number(f.livro_id) === Number(id)), 0);
    cPopulares.innerHTML = [...lista].sort((a, b) => favs(b.id) - favs(a.id)).slice(0, 15).map(card).join('');
    cRecentes.innerHTML = [...lista].sort((a, b) => b.id - a.id).slice(0, 15).map(card).join('');
    cDoacao.innerHTML = doacoes.length ? doacoes.map(card).join('') : '<div class="muted" style="padding:15px">Nenhuma obra disponível para doação.</div>';
}

let _debounceBusca;
function filtrarAcervo() {
    clearTimeout(_debounceBusca);
    _debounceBusca = setTimeout(filtrarAcervoAgora, 180);
}

function filtrarAcervoAgora() {
    const termo = (document.getElementById('txtBusca')?.value ?? '').toLowerCase().trim();
    const acervoAtivo = acervoCompleto.filter(l => !l.em_lixeira);
    
    const filtrados = acervoAtivo.filter(l => {
        const tit = (l.titulo_principal || l.tituloPrincipal || '').toLowerCase();
        const aut = (l.nome_pessoal || l.nomePessoal || l.autor_entidade || '').toLowerCase();
        const ass = (l.assunto || '').toLowerCase();
        const isbn = (l.isbn || '').toLowerCase();
        const cdd = (l.classificacao_cdd || l.classificacao || '').toLowerCase();
        const tombo = (l.numero_tombo || l.tombo || '').toLowerCase();

        return tit.includes(termo) || 
               aut.includes(termo) || 
               ass.includes(termo) || 
               isbn.includes(termo) || 
               cdd.includes(termo) || 
               tombo.includes(termo);
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
        if (visaoLista) visaoLista.style.display = 'none';
        if (visaoGrade) visaoGrade.style.display = 'flex';
        if (btnLista) btnLista.classList.remove('active');
        if (btnGrade) btnGrade.classList.add('active');
    } else {
        if (visaoLista) visaoLista.style.display = 'flex';
        if (visaoGrade) visaoGrade.style.display = 'none';
        if (btnGrade) btnGrade.classList.remove('active');
        if (btnLista) btnLista.classList.add('active');
    }
}

function rolarCarrossel(idCarrossel, deslocamento) {
    const container = document.getElementById(idCarrossel);
    if (container) {
        container.scrollBy({ left: deslocamento, behavior: 'smooth' });
    }
}