// Venous • Tema dinâmico (white-label): lê configuracoes_sistema, injeta variáveis CSS e identidade (nome, logos, favicon) em qualquer página.
(() => {
const KEY = 'venous_tema', FONTES = ['Inter', 'Poppins', 'Nunito', 'Lora'];
const PADRAO = { nome_biblioteca: 'R.A.I.L.D.A', logo_url: '', logo_mini_url: '', favicon_url: '', cor_primaria: '#0369a1', cor_secundaria: '#0e7490', cor_destaque: '', cor_fundo: '#f1f5f9', cor_cards: '#ffffff', cor_texto: '#0f172a', fonte: 'Inter', raio_borda: 8, giphy_key: '' };
let atual = { ...PADRAO };
const raiz = document.documentElement, escuro = () => raiz.dataset.theme === 'dark' || (raiz.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
const contraste = hex => { const n = parseInt(String(hex).replace('#', ''), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#0f172a' : '#ffffff'; };
function estilo(id) { let s = document.getElementById(id); if (!s) { s = document.createElement('style'); s.id = id; document.head.appendChild(s); } return s; }

// Aplica as cores/fonte/borda (variáveis CSS em :root). Cores de fundo/card/texto só valem no modo claro para não quebrar o modo escuro.
function aplicar(cfg) {
  const c = { ...PADRAO, ...(cfg || {}) }; if (!c.nome_biblioteca || c.nome_biblioteca === 'Venous') c.nome_biblioteca = PADRAO.nome_biblioteca; atual = c; const s = raiz.style, claro = !escuro();
  const def = (v, val, pad, cond = true) => (cond && val && String(val).toLowerCase() !== String(pad).toLowerCase()) ? s.setProperty(v, val) : s.removeProperty(v);
  def('--primary-color', c.cor_primaria, PADRAO.cor_primaria); def('--link', c.cor_primaria, PADRAO.cor_primaria);
  if (c.cor_primaria.toLowerCase() !== PADRAO.cor_primaria) s.setProperty('--primary-hover', `color-mix(in srgb, ${c.cor_primaria} 80%, black)`); else s.removeProperty('--primary-hover');
  def('--secondary-color', c.cor_secundaria, PADRAO.cor_secundaria);
  def('--bg-primary', c.cor_fundo, PADRAO.cor_fundo, claro); def('--bg-secondary', c.cor_cards, PADRAO.cor_cards, claro); def('--bg-card', c.cor_cards, PADRAO.cor_cards, claro); def('--text-main', c.cor_texto, PADRAO.cor_texto, claro);
  const fonte = FONTES.includes(c.fonte) ? c.fonte : 'Inter';
  if (fonte !== 'Inter') { if (!document.getElementById('tema-fonte')) { const l = document.createElement('link'); l.id = 'tema-fonte'; l.rel = 'stylesheet'; document.head.appendChild(l); } document.getElementById('tema-fonte').href = `https://fonts.googleapis.com/css2?family=${fonte}:wght@400;600;700&display=swap`; s.setProperty('--font-main', `'${fonte}'`); } else s.removeProperty('--font-main');
  const r = Number(c.raio_borda); r !== 8 ? s.setProperty('--r', r + 'px') : s.removeProperty('--r');
  const btn = c.cor_destaque || ''; if (btn) s.setProperty('--btn-bg', btn); else s.removeProperty('--btn-bg');
  estilo('tema-css').textContent = (btn ? `.btn-primary,.chip.on,.tabs .on{background:var(--btn-bg)!important;border-color:var(--btn-bg)!important;color:${contraste(btn)}!important}` : '')
    + (r !== 8 ? `.btn,input:not([type=checkbox]):not([type=radio]):not([type=color]):not([type=range]),select,textarea,.chip,.pill{border-radius:var(--r)!important}.card,.box,.post,.modal-box,.kpi,.fav,.msg-card,.hero,.des-hero,.sel-chip,.etq-item,.rd-card{border-radius:calc(var(--r)*1.5)!important}` : '')
    + (c.logo_url ? `.logo-box h1{display:none}.logo-img{height:40px;width:auto;max-width:200px;object-fit:contain}${c.logo_mini_url ? '.logo-mini{display:none}@media(max-width:768px){.logo-full{display:none}.logo-mini{display:block}}' : ''}` : '');
  identidade();
}
// Nome da biblioteca, logotipos e favicon (precisa do DOM pronto)
function identidade() {
  if (!document.body) return; const c = atual, box = document.querySelector('.logo-box');
  if (box) {
    const h1 = box.querySelector('h1'); if (h1) { h1.textContent = c.nome_biblioteca || PADRAO.nome_biblioteca; if ((c.nome_biblioteca || PADRAO.nome_biblioteca) === PADRAO.nome_biblioteca) h1.title = 'Recuperação Ampliada de Informação e Logística de Dados e Armazenamento'; else h1.removeAttribute('title'); }
    box.querySelectorAll('.logo-img').forEach(e => e.remove());
    if (c.logo_url) { const mk = (u, cl) => { const i = document.createElement('img'); i.src = u; i.alt = c.nome_biblioteca; i.className = 'logo-img ' + cl; return i; }; box.prepend(mk(c.logo_url, 'logo-full')); if (c.logo_mini_url) box.prepend(mk(c.logo_mini_url, 'logo-mini')); }
  }
  const nome = c.nome_biblioteca || PADRAO.nome_biblioteca; const sub = box?.querySelector('h3'); if (sub) sub.style.display = (c.nome_biblioteca || PADRAO.nome_biblioteca) === PADRAO.nome_biblioteca ? '' : 'none';
  document.title = document.title.replace(/•\s*[^•]*$/, '• ' + nome);
  document.querySelectorAll('footer').forEach(f => { const w = document.createTreeWalker(f, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { if (n.__orig === undefined && /R\.A\.I\.L\.D\.A|Venous/.test(n.nodeValue)) n.__orig = n.nodeValue; if (n.__orig) n.nodeValue = n.__orig.replace(/R\.A\.I\.L\.D\.A|Venous/g, nome); } });
  let ic = document.querySelector('link[rel~="icon"]'); if (c.favicon_url) { if (!ic) { ic = document.createElement('link'); ic.rel = 'icon'; document.head.appendChild(ic); } ic.href = c.favicon_url; }
}
const salvarCache = c => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (_) {} };
async function carregar() {
  const sb = window.supabaseClient; if (!sb) return;
  try { const { data, error } = await sb.from('configuracoes_sistema').select('*').eq('id', 1).maybeSingle(); if (error || !data) return; const c = { ...PADRAO }; Object.keys(PADRAO).forEach(k => { if (data[k] !== null && data[k] !== undefined) c[k] = data[k]; }); salvarCache(c); aplicar(c); } catch (_) {}
}
let cache = null; try { cache = JSON.parse(localStorage.getItem(KEY)); } catch (_) {}
if (cache) aplicar(cache);                                                       // aplica o último tema salvo antes de pintar a página (sem "piscar")
document.addEventListener('DOMContentLoaded', () => { identidade(); carregar(); });
new MutationObserver(() => aplicar(atual)).observe(raiz, { attributes: true, attributeFilter: ['data-theme'] }); matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => aplicar(atual));
window.VenousTema = { PADRAO, FONTES, aplicar, salvarCache, config: () => ({ ...atual }), recarregar: carregar, limparCache: () => localStorage.removeItem(KEY) };
})();
