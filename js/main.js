// Inicialização e navegação por #hash.
import { criarStore, pedirPersistencia } from './store.js';
import { carregarDados, aplicarEdicoes } from './data.js';
import { telaLista } from './views/lista.js';
import { telaArma } from './views/arma.js';
import { telaPainel } from './views/painel.js';
import { telaConfig } from './views/config.js';
import { telaEditor } from './views/editor.js';
import { esc } from './ui.js';

/** Contexto compartilhado pelas telas. */
export const app = {
  store: null,
  bruto: null,        // mw4.json como veio do arquivo
  estado: null,       // progresso do usuário
  dados: null,        // mw4.json + edições
  conflitos: [],
  avisos: [],
  persistente: null,

  recalcular() {
    const r = aplicarEdicoes(this.bruto, this.estado);
    this.dados = r.dados; this.conflitos = r.conflitos; this.avisos = r.avisos;
  },
  /** Chame depois de mudar `app.estado`. */
  async salvar() {
    this.recalcular();
    await this.store.salvar(this.estado);
  },
  async substituirEstado(novo) {
    this.estado = novo;
    await this.salvar();
  },
};

const rotas = [
  [/^#\/arma\/([^/]+)$/, (m) => telaArma(app, decodeURIComponent(m[1])), 'armas'],
  [/^#\/painel$/, () => telaPainel(app), 'painel'],
  [/^#\/config$/, () => telaConfig(app), 'config'],
  [/^#\/editor\/arma\/([^/]+)$/, (m) => telaEditor(app, ['arma', decodeURIComponent(m[1])]), 'config'],
  [/^#\/editor\/(mastery|nova)$/, (m) => telaEditor(app, [m[1]]), 'config'],
  [/^#\/editor$/, () => telaEditor(app, ['indice']), 'config'],
  [/^/, () => telaLista(app), 'armas'],
];

let limparTela = null;
function navegar() {
  // elemento novo a cada tela: os ouvintes de eventos da tela anterior vão embora junto
  const antiga = document.getElementById('tela');
  const tela = antiga.cloneNode(false);
  limparTela?.();
  limparTela = null;
  const hash = location.hash || '#/armas';
  for (const [re, fn, aba] of rotas) {
    const m = hash.match(re);
    if (!m) continue;
    document.querySelectorAll('.abas a').forEach((a) => a.removeAttribute('aria-current'));
    document.querySelector(`.abas a[data-aba="${aba}"]`)?.setAttribute('aria-current', 'page');
    antiga.replaceWith(tela);
    limparTela = fn(m)?.(tela) ?? null; // cada tela devolve montar(el) → limpar()
    break;
  }
}

async function iniciar() {
  try {
    app.store = await criarStore();
    [app.bruto, app.estado, app.persistente] = await Promise.all([
      carregarDados(), app.store.carregar(), pedirPersistencia(),
    ]);
    app.recalcular();
    addEventListener('hashchange', navegar);
    navegar();
  } catch (e) {
    document.getElementById('tela').innerHTML =
      `<div class="pagina"><h1>Não foi possível abrir</h1><p class="aviso-txt">${esc(e.message)}</p></div>`;
    console.error(e);
  }
}

/** Registra o service worker (offline) e avisa quando há versão nova do app. */
async function registrarSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    const aviso = document.querySelector('.atualizacao');
    const mostrar = (sw) => {
      aviso.hidden = false;
      aviso.querySelector('[data-atualizar]').onclick = () => sw.postMessage('atualizar');
    };
    if (reg.waiting && navigator.serviceWorker.controller) mostrar(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const novo = reg.installing;
      novo?.addEventListener('statechange', () => {
        if (novo.state === 'installed' && navigator.serviceWorker.controller) mostrar(novo);
      });
    });
    let recarregando = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!recarregando) { recarregando = true; location.reload(); }
    });
    // procura atualização ao voltar para o app
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  } catch (e) {
    console.warn('Service worker não registrado:', e);
  }
}

iniciar();
registrarSW();
