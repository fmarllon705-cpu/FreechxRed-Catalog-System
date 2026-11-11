// Venous • mostra a barra do Acervo (Consulta/Feed/Favoritos/...) e itens de equipe conforme o login
(() => {
  const t = setInterval(() => {
    if (typeof usuarioAtual === 'undefined' || !usuarioAtual) return;
    const logado = usuarioAtual.nome && usuarioAtual.nome !== 'Visitante (Público)', equipe = ['bibliotecario', 'estagiario'].includes((usuarioAtual.cargo || '').toLowerCase());
    const b = document.getElementById('acervoTabs'); if (b) b.style.display = logado ? '' : 'none';
    document.querySelectorAll('[data-staff]').forEach(e => e.style.display = equipe ? '' : 'none');
  }, 150);
  setTimeout(() => clearInterval(t), 10000);
})();
