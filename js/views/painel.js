// Painel geral: anéis de progresso, Divergence, Mastery por modo, progresso por categoria e próximos passos.
import { esc, prefs, seloValidar } from '../ui.js';
import { estatisticas, proximosPassos } from '../stats.js';
import { alternarDivergence } from '../rules.js';
import { FILTROS_PADRAO } from '../progresso.js';
import { barraTopo, ICONE, ORDEM_MODOS, MODOS, modoAtivo, anel, criarToast } from '../visual.js';

export function telaPainel(app) {
  return (el) => {
    const modo = modoAtivo();
    el.innerHTML = `${barraTopo()}<div class="pagina painel" data-conteudo></div>`;
    const toast = criarToast(el);

    function render() {
      const s = estatisticas(app.dados, app.estado);
      const passos = proximosPassos(app.dados, app.estado);
      const dv = s.divergence;
      const dmzPend = app.dados.regras?.mastery_hb_minimo_status;
      const tile = (rotulo, n, cls) => `<div class="tile ${cls}">
        ${anel(n / (s.total || 1), { tam: 64, espessura: 6, texto: `${n}` })}
        <div><div class="tile-rot">${rotulo}</div><div class="num">${n} de ${s.total}</div></div></div>`;

      el.querySelector('[data-conteudo]').innerHTML = `
        <h1 class="pag-tit">Painel <em>geral</em></h1>
        <div class="tiles">
          ${tile('Gold', s.gold, 'gold')}
          ${tile('Platinum', s.platinum, 'platinum')}
          ${tile('Harmonic Break', s.harmonic, 'harmonic')}
          ${tile('Trilhas completas', s.trilhasCompletas, 'completa')}
        </div>

        <section class="bloco divergence-bloco ${dv.feita ? 'feita' : ''}">
          <div class="dv-fundo" aria-hidden="true"></div>
          <div class="bloco-linha">
            <div><span class="pill cheia mini">FINAL</span>
              <div class="bloco-tit grande">Divergence ${app.dados.divergence?.status === 'pendente' ? seloValidar() : ''}</div>
              <div class="dica">${dv.feita ? 'Obtida ✓' : dv.min != null ? `Harmonic Break em ${dv.total}/${dv.min} armas` : 'Regra a validar'}</div></div>
            <button type="button" class="check" role="checkbox" aria-checked="${dv.feita}" aria-disabled="${dv.bloqueada}"
              aria-label="Divergence" data-acao="divergence">${dv.feita ? ICONE.check : dv.bloqueada ? ICONE.cadeado : ''}</button>
          </div>
          ${dv.min != null ? `<div class="barra grossa"><span style="width:${Math.min(100, Math.round((dv.total / dv.min) * 100))}%"></span></div>` : ''}
        </section>

        <h2 class="sec-tit">Mastery</h2>
        <div class="mastery-grade">
          ${[modo, ...ORDEM_MODOS.filter((m) => m !== modo)].filter((m) => s.mastery[m]).map((m) => `<section class="bloco mastery-bloco ${m === modo ? 'ativo' : ''}">
            <div class="bloco-tit">${esc(MODOS[m].nome)} ${dmzPend?.[m] === 'pendente' ? seloValidar() : ''}</div>
            <ul class="linhas">${s.mastery[m].map((x) => `<li><span>${esc(x.nome)}</span>
              <span class="mini-barra"><span style="width:${Math.round((x.feitas / (s.total || 1)) * 100)}%"></span></span>
              <span class="num">${x.feitas}/${s.total}</span></li>`).join('')}</ul>
          </section>`).join('')}
        </div>

        <h2 class="sec-tit">Por categoria <small>Gold → Platinum</small></h2>
        <ul class="linhas bloco cat-lista">
          ${s.categorias.map((c) => `<li><button type="button" class="linha-btn" data-acao="cat" data-cat="${esc(c.id)}">
            <span class="cat-cab"><span class="cat-nome">${esc(c.nome)}</span><span class="num">${c.comGold}/${c.total}</span></span>
            <span class="barra ${c.platinumLiberado ? 'completa' : ''}"><span style="width:${Math.round((c.comGold / (c.total || 1)) * 100)}%"></span></span>
            <span class="cat-txt ${c.platinumLiberado ? 'ok' : ''}">${esc(c.texto)}</span></button></li>`).join('')}
          ${s.semCategoria ? `<li><button type="button" class="linha-btn" data-acao="cat" data-cat="__sem">
            <span class="cat-nome">Sem categoria</span>
            <span class="cat-txt aviso-txt">${s.semCategoria} armas para classificar</span></button></li>` : ''}
        </ul>

        <h2 class="sec-tit">Próximos passos</h2>
        ${passos.length ? `<ul class="linhas bloco">${passos.map((p) => `<li>
          <a class="linha-btn passo" href="#/arma/${encodeURIComponent(p.arma.id)}">
            <span class="cat-nome">${esc(p.arma.nome)}</span>
            <span class="cat-txt ${p.distancia === 0 ? 'ok' : ''}">${esc(p.texto)}</span>${ICONE.seta}</a></li>`).join('')}</ul>`
          : '<p class="vazio">Comece uma arma para ver sugestões aqui.</p>'}`;
    }

    el.addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-acao]');
      if (!b) return;
      if (b.dataset.acao === 'divergence') {
        const r = alternarDivergence(app.dados, app.estado);
        if (!r.ok) { toast.mostrar(`Bloqueada — ${r.motivos.join(' · ')}`); return; }
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
    return () => toast.limpar();
  };
}
