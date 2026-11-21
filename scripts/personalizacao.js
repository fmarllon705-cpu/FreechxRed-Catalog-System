// Venous • Painel de Personalização (white-label) — somente bibliotecário. Grava via RPC salvar_configuracoes (valida cargo + senha no servidor).
(() => {
const $ = s => document.querySelector(s), esc = v => escaparHTML(v), T = () => window.VenousTema, toast = (...a) => window.hubToast(...a);
const ehBibliotecario = () => typeof usuarioAtual !== 'undefined' && usuarioAtual && String(usuarioAtual.cargo || '').toLowerCase() === 'bibliotecario';
let draft = null, pronto = false;
const CORES = [['cor_primaria', 'Cor primária', 'Links, abas e destaques'], ['cor_secundaria', 'Cor secundária', 'Degradês e faixas'], ['cor_destaque', 'Cor de destaque / botões', 'Botões principais (vazio = cor primária)'], ['cor_fundo', 'Fundo da página', 'Modo claro'], ['cor_cards', 'Fundo dos cards', 'Modo claro'], ['cor_texto', 'Cor dos textos', 'Modo claro']];
const IMGS = [['logo_url', 'Logotipo principal', 'Cabeçalho (PC)'], ['logo_mini_url', 'Logotipo reduzido', 'Celular / barra lateral'], ['favicon_url', 'Favicon', 'Ícone da aba do navegador']];
const FONTES = { Inter: 'Inter (padrão)', Poppins: 'Poppins (geométrica)', Nunito: 'Nunito (arredondada)', Lora: 'Lora (serifada)' };

function aplicarDraft() { T().aplicar(draft); }
function blobDe(canvas, tipo) { return new Promise(ok => canvas.toBlob(ok, tipo)); }
async function prepararImagem(file, max) {                                         // reduz imagens grandes (mantém SVG/ICO como estão)
  if (/svg|icon/.test(file.type)) return { blob: file, ext: file.type.includes('svg') ? 'svg' : 'ico', tipo: file.type };
  const url = URL.createObjectURL(file), im = new Image(); await new Promise((ok, no) => { im.onload = ok; im.onerror = () => no(new Error('Imagem inválida')); im.src = url; });
  const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
  return { blob: await blobDe(c, 'image/png'), ext: 'png', tipo: 'image/png' };
}
const dataUrl = blob => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });
async function enviar(file, campo) {
  const { blob, ext, tipo } = await prepararImagem(file, campo === 'favicon_url' ? 128 : 600);
  if (window.supabaseClient) {
    const path = `${campo}-${Date.now()}.${ext}`, { error } = await window.supabaseClient.storage.from('branding').upload(path, blob, { contentType: tipo, upsert: true });
    if (!error) return window.supabaseClient.storage.from('branding').getPublicUrl(path).data.publicUrl;
    toast('Storage indisponível (' + error.message + '). Usando a imagem embutida.', 'erro');
  }
  return dataUrl(blob);
}
function desenhar() {
  const root = $('#pzRoot'); if (!ehBibliotecario()) { root.innerHTML = '<div class="hint"><i class="fa-solid fa-lock"></i> A personalização do sistema é exclusiva para o cargo de bibliotecário.</div>'; return; }
  const c = draft;
  root.innerHTML = `<div class="pz-grid">
  <div class="box"><h4><i class="fa-solid fa-id-badge"></i> Identidade visual</h4>
    <div class="field"><label for="pzNome">Nome da biblioteca / instituição</label><input id="pzNome" maxlength="60" value="${esc(c.nome_biblioteca)}"></div>
    ${IMGS.map(([k, n, d]) => `<div class="pz-img"><div class="pz-prev" id="prev_${k}">${c[k] ? `<img src="${esc(c[k])}" alt="">` : '<i class="fa-regular fa-image"></i>'}</div><div style="flex:1"><b>${n}</b><br><small class="muted">${d}</small><div class="btn-group" style="margin-top:6px"><label class="btn btn-outline btn-sm"><i class="fa-solid fa-upload"></i> Enviar<input type="file" accept="image/*" data-img="${k}" hidden></label>${c[k] ? `<button class="btn btn-outline btn-sm" data-rm="${k}">Remover</button>` : ''}</div></div></div>`).join('')}
  </div>
  <div class="box"><h4><i class="fa-solid fa-palette"></i> Paleta de cores</h4>
    ${CORES.map(([k, n, d]) => `<div class="pz-cor"><input type="color" data-cor="${k}" value="${c[k] || c.cor_primaria}"><div style="flex:1"><b>${n}</b><br><small class="muted">${d}</small></div>${k === 'cor_destaque' && c[k] ? `<button class="btn btn-outline btn-sm" data-rm="cor_destaque">Usar primária</button>` : ''}</div>`).join('')}
  </div>
  <div class="box"><h4><i class="fa-solid fa-font"></i> Tipografia e estilo</h4>
    <div class="field"><label for="pzFonte">Fonte</label><select id="pzFonte">${Object.entries(FONTES).map(([k, n]) => `<option value="${k}" ${c.fonte === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    <div class="field"><label for="pzRaio">Arredondamento das bordas: <b id="pzRaioV">${c.raio_borda}px</b></label><input type="range" id="pzRaio" min="0" max="24" value="${c.raio_borda}"></div>
    <div class="field"><label for="pzGiphy">Chave da API do Giphy (opcional)</label><input id="pzGiphy" placeholder="Ativa a busca de GIFs no feed" value="${esc(c.giphy_key || '')}"></div>
    <div class="pz-demo"><button class="btn btn-primary">Botão</button> <span class="pill">Etiqueta</span> <input placeholder="Campo de texto" style="width:150px"></div>
  </div></div>
  <div class="box" style="margin-top:16px"><h4><i class="fa-solid fa-shield-halved"></i> Salvar (confirmação de bibliotecário)</h4>
    <div class="toolbar"><input type="password" id="pzSenha" placeholder="Digite sua senha para confirmar" autocomplete="current-password"><button class="btn btn-primary" id="pzSalvar"><i class="fa-solid fa-floppy-disk"></i> Salvar personalização</button><button class="btn btn-outline" id="pzRestaurar"><i class="fa-solid fa-rotate-left"></i> Restaurar padrão</button></div>
    <div id="pzMsg" class="hint">As alterações já aparecem aqui em tempo real, mas só valem para todos depois de salvar.</div></div>`;
}
function msg(t, erro) { const m = $('#pzMsg'); m.textContent = t; m.style.color = erro ? 'var(--accent-red)' : ''; }
async function rpc(nome, args) {
  const sb = window.supabaseClient; if (!sb) { return { local: true }; }
  const { error } = await sb.rpc(nome, args); if (error) throw new Error(/function|does not exist|schema cache/i.test(error.message) ? 'Funções do servidor ausentes: execute supabase_updates.sql.' : error.message); return {};
}
async function salvar() {
  if (!ehBibliotecario()) return; const senha = $('#pzSenha').value; if (!senha) return msg('Informe sua senha para confirmar.', true);
  const btn = $('#pzSalvar'); btn.disabled = true;
  try {
    draft.nome_biblioteca = $('#pzNome').value.trim() || 'R.A.I.L.D.A'; const r = await rpc('salvar_configuracoes', { p_usuario_id: usuarioAtual.id, p_senha: senha, p_dados: draft });
    T().salvarCache(draft); T().aplicar(draft); $('#pzSenha').value = ''; msg(r.local ? 'Salvo apenas neste navegador (sem conexão com o Supabase).' : 'Personalização salva para todos os usuários.'); toast('Personalização salva!');
  } catch (e) { msg(e.message, true); } finally { btn.disabled = false; }
}
async function restaurar() {
  if (!ehBibliotecario()) return; if (!$('#pzSenha').value) return msg('Informe sua senha para restaurar o padrão.', true);
  if (!await confirmarAcao('Restaurar o padrão?', 'Logotipos, cores, fonte e bordas voltarão ao visual original do sistema.', 'Restaurar')) return;
  try { await rpc('restaurar_configuracoes', { p_usuario_id: usuarioAtual.id, p_senha: $('#pzSenha').value }); T().limparCache(); draft = { ...T().PADRAO }; T().aplicar(draft); desenhar(); msg('Visual padrão restaurado.'); toast('Padrão restaurado'); } catch (e) { msg(e.message, true); }
}
function ligar() {
  const root = $('#pzRoot');
  root.oninput = e => { const t = e.target; if (t.dataset.cor) draft[t.dataset.cor] = t.value; else if (t.id === 'pzFonte') draft.fonte = t.value; else if (t.id === 'pzRaio') { draft.raio_borda = +t.value; $('#pzRaioV').textContent = t.value + 'px'; } else if (t.id === 'pzGiphy') draft.giphy_key = t.value.trim(); else if (t.id === 'pzNome') draft.nome_biblioteca = t.value; aplicarDraft(); };
  root.onchange = async e => { const t = e.target; if (!t.dataset.img || !t.files[0]) return; try { draft[t.dataset.img] = await enviar(t.files[0], t.dataset.img); aplicarDraft(); desenhar(); toast('Imagem carregada.'); } catch (x) { toast(x.message, 'erro'); } };
  root.onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.rm) { draft[b.dataset.rm] = ''; aplicarDraft(); desenhar(); } else if (b.id === 'pzSalvar') salvar(); else if (b.id === 'pzRestaurar') restaurar(); };
}
window.initPersonalizacao = () => { if (!$('#pzRoot')) return; if (!pronto) { pronto = true; draft = { ...T().PADRAO, ...T().config() }; ligar(); } desenhar(); };
})();
