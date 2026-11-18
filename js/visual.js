// Peças visuais compartilhadas: modo ativo (MP / WZ / DMZ), barra do topo, amostras de camo e ícones.
// As amostras são padrões em CSS (nenhuma arte do jogo é usada).
import { esc, prefs } from './ui.js';

export const MODOS = {
  MP: { nome: 'Multiplayer', titulo: ['MULTIPLAYER', ''], cor: '#ffc81e' },
  WZ: { nome: 'Warzone', titulo: ['WAR', 'ZONE'], cor: '#3ee0a1' },
  DMZ: { nome: 'DMZ', titulo: ['', 'DMZ'], cor: '#ff8a3d' },
};
export const ORDEM_MODOS = ['MP', 'WZ', 'DMZ'];

export const modoAtivo = () => {
  const m = prefs.ler('modo', 'MP');
  return MODOS[m] ? m : 'MP';
};
export function definirModoAtivo(m) {
  if (!MODOS[m]) return;
  prefs.gravar('modo', m);
  document.documentElement.dataset.modo = m;
}

/** Texto do desafio de uma camo para um modo. */
export function desafioNoModo(c, modo) {
  const t = c.desafio_modo?.[modo] || (c.desafio && c.desafio !== 'Varia por modo' ? c.desafio : '');
  return t || '';
}
export const metaNoModo = (c, modo) => c.meta?.[modo] ?? null;

// ---------- ícones (SVG em linha, herdam a cor do texto) ----------
const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
export const ICONE = {
  voltar: svg('<path d="M15 18l-6-6 6-6"/>'),
  estrela: svg('<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>'),
  estrelaCheia: svg('<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" fill="currentColor"/>'),
  busca: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
  filtro: svg('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'),
  cadeado: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 'stroke-width="3"'),
  armas: svg('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
  painel: svg('<path d="M12 3a9 9 0 109 9h-9z"/><path d="M15 3.5A9 9 0 0120.5 9H15z"/>'),
  config: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>'),
  editar: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'),
  seta: svg('<path d="M9 6l6 6-6 6"/>'),
  medalha: svg('<circle cx="12" cy="9" r="6"/><path d="M8.5 14L7 22l5-3 5 3-1.5-8"/><path d="M12 6.5l.9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3z" fill="currentColor" stroke="none"/>'),
  alvo: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
};

/** Barra do topo usada em todas as telas. `voltar` = href do botão voltar (opcional). */
export function barraTopo({ voltar = null, direita = '' } = {}) {
  const m = modoAtivo();
  return `<header class="app-bar">
    ${voltar ? `<a class="icone-btn" href="${voltar}" aria-label="Voltar">${ICONE.voltar}</a>` : ''}
    <a class="logo" href="#/armas" aria-label="Camo MW4 — início"><span>CAMO</span><b>MW4</b></a>
    <div class="modo-pills" role="group" aria-label="Modo de jogo">
      ${ORDEM_MODOS.map((k) => `<button type="button" data-modo-global="${k}" aria-pressed="${k === m}">${k}</button>`).join('')}
    </div>
    ${direita}
  </header>`;
}

// ---------- amostras de camo ----------
function hash(s) {
  let h = 2166136261;
  for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Classe + estilo de uma amostra. tipo: militar | especial | gold | platinum | harmonic-break | mastery | divergence */
export function estiloAmostra(tipo, { indice = 0, nome = '' } = {}) {
  if (tipo === 'militar') return { cls: `sw-mil sw-m${(indice % 8) + 1}`, style: '' };
  if (tipo === 'especial') {
    const h = hash(nome);
    return { cls: `sw-esp sw-v${h % 4}`, style: `--h:${h % 360};--h2:${(h >> 9) % 360}` };
  }
  if (tipo === 'mastery') {
    const h = hash(nome);
    return { cls: 'sw-mastery', style: `--h:${h % 360}` };
  }
  return { cls: `sw-${tipo}`, style: '' };
}

/**
 * Botão-amostra (marca/desmarca). `estado`: feita | bloqueada | livre. `proxima` destaca a próxima camo.
 */
export function amostra({ tipo, indice, nome, chave, armaId, feita, bloqueada, proxima, titulo, rotulo = '', tam = '' }) {
  const { cls, style } = estiloAmostra(tipo, { indice, nome });
  const estado = feita ? 'feita' : bloqueada ? 'bloqueada' : 'livre';
  return `<button type="button" class="sw ${cls} ${estado} ${proxima ? 'proxima' : ''} ${tam}" style="${style}"
    data-acao="sw" data-chave="${esc(chave)}" ${armaId ? `data-arma="${esc(armaId)}"` : ''}
    role="checkbox" aria-checked="${feita}" aria-disabled="${bloqueada}"
    aria-label="${esc(nome)}${bloqueada ? ' (bloqueada)' : ''}" title="${esc(titulo || nome)}">
    ${feita ? `<i class="sw-ok">${ICONE.check}</i>` : bloqueada ? `<i class="sw-lock">${ICONE.cadeado}</i>` : ''}
    ${rotulo ? `<span class="sw-rot">${esc(rotulo)}</span>` : ''}
  </button>`;
}

/** Anel de progresso em SVG. */
export function anel(frac, { tam = 64, espessura = 6, texto = '', cls = '' } = {}) {
  const r = (tam - espessura) / 2;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, frac || 0));
  return `<div class="anel ${cls}" style="width:${tam}px;height:${tam}px">
    <svg viewBox="0 0 ${tam} ${tam}" width="${tam}" height="${tam}" aria-hidden="true">
      <circle cx="${tam / 2}" cy="${tam / 2}" r="${r}" stroke-width="${espessura}" class="anel-fundo"/>
      <circle cx="${tam / 2}" cy="${tam / 2}" r="${r}" stroke-width="${espessura}" class="anel-valor"
        stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - f)).toFixed(2)}"
        transform="rotate(-90 ${tam / 2} ${tam / 2})"/>
    </svg>
    <span class="anel-txt">${texto}</span>
  </div>`;
}

/** Toast simples reutilizável. Retorna { mostrar(texto, acao?), limpar() }. */
export function criarToast(el) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.hidden = true;
  t.innerHTML = '<span data-toast-txt></span><button type="button" class="link-btn" data-toast-acao hidden></button>';
  el.appendChild(t);
  let timer = null;
  let fn = null;
  t.querySelector('[data-toast-acao]').addEventListener('click', () => { const f = fn; esconder(); f?.(); });
  function esconder() { t.hidden = true; fn = null; t.classList.remove('entra'); }
  return {
    mostrar(texto, acao = null) {
      t.querySelector('[data-toast-txt]').textContent = texto;
      const b = t.querySelector('[data-toast-acao]');
      b.hidden = !acao;
      if (acao) { b.textContent = acao.rotulo; fn = acao.fn; } else fn = null;
      t.hidden = false;
      t.classList.remove('entra'); void t.offsetWidth; t.classList.add('entra');
      clearTimeout(timer);
      timer = setTimeout(esconder, acao ? 6000 : 3200);
    },
    limpar() { clearTimeout(timer); },
  };
}
