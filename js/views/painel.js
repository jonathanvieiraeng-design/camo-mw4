// Painel geral: contadores, Divergence, Mastery por modo, progresso por categoria e próximos passos.
import { esc, prefs, seloValidar } from '../ui.js';
import { estatisticas, proximosPassos } from '../stats.js';
import { alternarDivergence } from '../rules.js';
import { FILTROS_PADRAO } from '../progresso.js';

const ORDEM_MASTERY = ['MP', 'WZ', 'DMZ'];

export function telaPainel(app) {
  return (el) => {
    function render() {
      const s = estatisticas(app.dados, app.estado);
      const passos = proximosPassos(app.dados, app.estado);
      const tile = (rotulo, n, cls) => `<div class="tile ${cls}">
        <div class="tile-num">${n}<small>/${s.total}</small></div><div class="tile-rot">${rotulo}</div>
        <div class="barra"><span style="width:${Math.round((n / (s.total || 1)) * 100)}%"></span></div></div>`;
      const dv = s.divergence;
      const dmzPend = app.dados.regras?.mastery_hb_minimo_status;

      el.innerHTML = `<div class="pagina painel">
        <h1>Painel</h1>
        <div class="tiles">
          ${tile('Gold', s.gold, 'gold')}
          ${tile('Platinum', s.platinum, 'platinum')}
          ${tile('Harmonic Break', s.harmonic, 'harmonic')}
          ${tile('Trilhas completas', s.trilhasCompletas, 'completa')}
        </div>

        <section class="bloco divergence ${dv.feita ? 'feita' : ''}">
          <div class="bloco-linha">
            <div><div class="bloco-tit">Divergence ${app.dados.divergence?.status === 'pendente' ? seloValidar() : ''}</div>
              <div class="dica">${dv.feita ? 'Obtida ✓' : dv.min != null ? `Harmonic Break em ${dv.total}/${dv.min} armas` : 'Regra a validar'}</div></div>
            <button type="button" class="check" role="checkbox" aria-checked="${dv.feita}" aria-disabled="${dv.bloqueada}"
              aria-label="Divergence" data-acao="divergence">${dv.feita ? '✓' : dv.bloqueada ? '🔒' : ''}</button>
          </div>
        </section>

        <h2>Mastery</h2>
        <div class="mastery-grade">
          ${ORDEM_MASTERY.filter((m) => s.mastery[m]).map((modo) => `<section class="bloco">
            <div class="bloco-tit">${modo} ${dmzPend?.[modo] === 'pendente' ? seloValidar() : ''}</div>
            <ul class="linhas">${s.mastery[modo].map((m) => `<li><span>${esc(m.nome)}</span>
              <span class="num">${m.feitas}/${s.total}</span></li>`).join('')}</ul>
          </section>`).join('')}
        </div>

        <h2>Por categoria <span class="dica">(Platinum)</span></h2>
        <ul class="linhas bloco">
          ${s.categorias.map((c) => `<li><button type="button" class="linha-btn" data-acao="cat" data-cat="${esc(c.id)}">
            <span class="cat-nome">${esc(c.nome)}</span>
            <span class="cat-txt ${c.platinumLiberado ? 'ok' : ''}">${esc(c.texto)}</span></button></li>`).join('')}
          ${s.semCategoria ? `<li><button type="button" class="linha-btn" data-acao="cat" data-cat="__sem">
            <span class="cat-nome">Sem categoria</span>
            <span class="cat-txt aviso-txt">${s.semCategoria} armas para classificar</span></button></li>` : ''}
        </ul>

        <h2>Próximos passos</h2>
        ${passos.length ? `<ul class="linhas bloco">${passos.map((p) => `<li>
          <a class="linha-btn" href="#/arma/${encodeURIComponent(p.arma.id)}">
            <span class="cat-nome">${esc(p.arma.nome)}</span>
            <span class="cat-txt ${p.distancia === 0 ? 'ok' : ''}">${esc(p.texto)}</span></a></li>`).join('')}</ul>`
          : '<p class="vazio">Comece uma arma para ver sugestões aqui.</p>'}
      </div>
      <div class="toast" role="status" hidden><span data-toast-txt></span></div>`;
    }

    let timer = null;
    el.addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-acao]');
      if (!b) return;
      if (b.dataset.acao === 'divergence') {
        const r = alternarDivergence(app.dados, app.estado);
        if (!r.ok) {
          const t = el.querySelector('.toast');
          el.querySelector('[data-toast-txt]').textContent = `Bloqueada — ${r.motivos.join(' · ')}`;
          t.hidden = false; clearTimeout(timer); timer = setTimeout(() => { t.hidden = true; }, 3500);
          return;
        }
        render();
        await app.salvar();
      }
      if (b.dataset.acao === 'cat') {
        // abre a lista já filtrada por essa categoria
        prefs.gravar('filtros', { ...FILTROS_PADRAO, ordem: prefs.ler('filtros', {}).ordem || 'nome', categorias: [b.dataset.cat] });
        prefs.gravar('lista-scroll', 0);
        location.hash = '#/armas';
      }
    });

    render();
    scrollTo(0, 0);
    return () => clearTimeout(timer);
  };
}
