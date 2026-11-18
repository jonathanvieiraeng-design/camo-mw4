// Detalhe da arma: próxima camo em destaque, nível, trilha de camos e Mastery por modo.
import { esc, prefs, seloValidar } from '../ui.js';
import { aValidar, trilha } from '../data.js';
import { chaveMastery } from '../progresso.js';
import { situacao, marcar, desmarcar, definirNivel, proximaMilitar, ajustarContador, definirModo,
  contarHB, feita } from '../rules.js';
import { barraTopo, ICONE, MODOS, ORDEM_MODOS, modoAtivo, amostra, anel, desafioNoModo, metaNoModo, criarToast } from '../visual.js';
import { proximaCamo } from './lista.js';

const ROTULO = { militar: 'Militar', especial: 'Especial', gold: 'Gold', platinum: 'Platinum', 'harmonic-break': 'Harmonic Break' };

export function telaArma(app, id) {
  return (el) => {
    const arma = () => app.dados.armas.find((a) => a.id === id);
    if (!arma()) {
      el.innerHTML = `${barraTopo({ voltar: '#/armas' })}<div class="pagina"><h1>Arma não encontrada</h1></div>`;
      return;
    }
    const modo = modoAtivo();
    let aba = prefs.ler('aba-arma', 'trilha');
    if (aba !== 'trilha' && !ORDEM_MODOS.includes(aba)) aba = 'trilha';
    const abertos = new Set(); // contadores expandidos

    el.innerHTML = `${barraTopo({ voltar: '#/armas', direita: '<button type="button" class="icone-btn fav" data-acao="fav"></button>' })}
      <div class="detalhe">
        <div data-cabecalho></div>
        <div data-corpo class="det-corpo"></div>
      </div>`;
    scrollTo(0, 0);

    const $ = (s) => el.querySelector(s);
    const toast = criarToast(el);
    const prog = () => app.estado.armas[id] || { nivel: null, camos: {} };
    const reg = (k) => prog().camos[k] || {};
    const modoDe = (chave) => reg(chave).modo || modo;

    // ---------- pedaços de HTML ----------

    function outrosModos(c, chave) {
      const atual = modoDe(chave);
      return `<div class="modos-chips">${ORDEM_MODOS.map((m) => {
        const t = desafioNoModo(c, m);
        return `<button type="button" class="modo-chip ${m === atual ? 'sel' : ''}" data-acao="modo" data-chave="${esc(chave)}"
          data-modo="${m}" aria-pressed="${m === atual}" title="${esc(t)}"><b>${m}</b> ${metaNoModo(c, m) ?? '?'}</button>`;
      }).join('')}</div>`;
    }

    function contadorHtml(chave, c) {
      const r = reg(chave);
      const m = modoDe(chave);
      const alvo = metaNoModo(c, m);
      const valor = r.contador ?? 0;
      const frac = alvo ? Math.min(1, valor / alvo) : 0;
      const aberto = abertos.has(chave);
      return `<div class="contador ${aberto ? 'aberto' : ''}">
        <button type="button" class="contador-resumo ${alvo != null && valor >= alvo ? 'atingido' : ''}" data-acao="abrir-cont"
          data-chave="${esc(chave)}" aria-expanded="${aberto}">
          <span class="barra"><span style="width:${Math.round(frac * 100)}%"></span></span>
          <span class="num">${valor}${alvo != null ? `/${alvo}` : ''} <small>${m}</small></span>
        </button>
        ${aberto ? `<div class="passos">
          <button type="button" class="btn" data-acao="cont" data-chave="${esc(chave)}" data-delta="-5">−5</button>
          <button type="button" class="btn" data-acao="cont" data-chave="${esc(chave)}" data-delta="-1">−1</button>
          <output>${valor}${alvo != null ? `<small>/${alvo}</small>` : ''}</output>
          <button type="button" class="btn" data-acao="cont" data-chave="${esc(chave)}" data-delta="1">+1</button>
          <button type="button" class="btn" data-acao="cont" data-chave="${esc(chave)}" data-delta="5">+5</button>
        </div>
        ${alvo != null && valor >= alvo && !r.ok ? '<p class="dica ok">Meta atingida — toque na amostra para marcar.</p>' : ''}` : ''}
      </div>`;
    }

    function camoHtml(a, c, chave, tipo, { proxima = false } = {}) {
      const s = situacao(app.dados, app.estado, a, chave);
      const r = reg(chave);
      const m = modoDe(chave);
      const des = desafioNoModo(c, m);
      const meta = metaNoModo(c, m);
      return `<li class="camo ${s.feita ? 'feita' : ''} ${s.bloqueada ? 'bloqueada' : ''} ${proxima ? 'proxima' : ''}">
        ${amostra({ tipo, nome: c.nome, chave, feita: s.feita, bloqueada: s.bloqueada, proxima, tam: 'grande' })}
        <div class="camo-corpo">
          <div class="camo-nome">${esc(c.nome)} ${aValidar(c) ? seloValidar() : ''}
            <span class="tipo-tag t-${tipo}">${ROTULO[tipo] ?? 'Mastery'}</span>
            ${s.feita && r.modo ? `<span class="modo-feito">${r.modo}</span>` : ''}</div>
          <div class="camo-desafio">${des ? esc(des) : '<i>Desafio a validar</i>'}${meta != null ? ` <span class="meta-num">${meta}</span>` : ''}</div>
          ${c.meta !== undefined ? outrosModos(c, chave) : ''}
          ${s.motivos.length && !s.feita ? `<ul class="motivos ${s.bloqueada ? '' : 'livre'}">${s.motivos.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
          ${s.feita ? '' : contadorHtml(chave, c)}
        </div>
      </li>`;
    }

    function militaresHtml(a) {
      const nivel = prog().nivel;
      return `<div class="mil-grade">${a.militares.map((m, i) => {
        const s = situacao(app.dados, app.estado, a, m.id);
        return `<div class="mil">${amostra({ tipo: 'militar', indice: i, nome: m.nome, chave: m.id, feita: s.feita, bloqueada: false,
          titulo: `${m.nome} — nível ${m.nivel ?? '?'}` })}
          <span class="mil-nv ${nivel != null && m.nivel != null && nivel >= m.nivel ? 'ok' : ''}">${m.nivel != null ? `Nv ${m.nivel}` : 'Nv ?'}</span></div>`;
      }).join('')}</div>`;
    }

    function destaqueProxima(a) {
      const p = proximaCamo(app, a);
      if (!p) {
        return `<section class="destaque completo">${ICONE.medalha}<div><b>Trilha completa!</b>
          <div class="dica">Agora é a vez das Mastery — veja as abas MP, WZ e DMZ abaixo.</div></div></section>`;
      }
      if (p.tipo === 'militar') {
        const pm = proximaMilitar(app.estado, a);
        return `<section class="destaque"><span class="destaque-rot">${ICONE.alvo} Próxima camuflagem</span>
          <div class="destaque-linha">${amostra({ tipo: 'militar', indice: a.militares.indexOf(p.camo), nome: p.camo.nome, chave: p.camo.id, feita: false, bloqueada: false, proxima: true, tam: 'grande' })}
          <div><b>${esc(p.camo.nome)}</b><div class="camo-desafio">Alcance o nível ${pm?.nivel ?? p.camo.nivel ?? '?'} da arma</div></div></div></section>`;
      }
      return `<section class="destaque"><span class="destaque-rot">${ICONE.alvo} Próxima camuflagem · ${MODOS[modoDe(p.camo.id)].nome}</span>
        <ul class="camos">${camoHtml(a, p.camo, p.camo.id, p.tipo, { proxima: true })}</ul></section>`;
    }

    function cabecalho(a) {
      const cat = a.categoria ? esc(app.dados.categorias.find((c) => c.id === a.categoria)?.nome ?? a.categoria) : 'Sem categoria';
      const p = prog();
      const prox = proximaMilitar(app.estado, a);
      const fav = app.estado.favoritas.includes(id);
      const btnFav = $('[data-acao="fav"]');
      btnFav.innerHTML = fav ? ICONE.estrelaCheia : ICONE.estrela;
      btnFav.setAttribute('aria-pressed', fav);
      btnFav.setAttribute('aria-label', fav ? 'Remover dos favoritos' : 'Favoritar');
      const t = trilha(a);
      const feitasT = t.filter((c) => feita(app.estado, id, c.id)).length;
      const nM = (m) => (app.dados.mastery[m] || []).filter((x) => feita(app.estado, id, chaveMastery(m, x.id))).length;
      $('[data-cabecalho]').innerHTML = `
        <section class="det-hero">
          <div class="det-hero-txt">
            <h1>${esc(a.nome)}</h1>
            <div class="arma-sub">${cat}${a.categoria_status === 'pendente' ? seloValidar() : ''}
              ${a.lancamento === false ? '<span class="selo dlc">DLC</span>' : ''}</div>
            <a class="link-sutil" href="#/editor/arma/${encodeURIComponent(id)}">${ICONE.editar} Editar dados</a>
          </div>
          ${anel(feitasT / t.length, { tam: 84, espessura: 7, texto: `${feitasT}<small>/${t.length}</small>`, cls: feitasT === t.length ? 'completo' : '' })}
        </section>
        ${destaqueProxima(a)}
        <section class="nivel-arma">
          <div class="nivel-cab"><label for="nivel">Nível da arma</label>
            <span class="dica">${prox ? `Próxima Militar no nível ${prox.nivel}` :
              a.militares.some((m) => m.nivel == null) ? 'Níveis a validar — marque manualmente.' : 'Todas as Militares obtidas.'}${
              a.nivel_max ? ` · máx. ${a.nivel_max}` : ''}</span></div>
          <div class="passos">
            <button type="button" class="btn" data-acao="nivel" data-delta="-1" aria-label="Diminuir nível">−</button>
            <input id="nivel" type="number" inputmode="numeric" min="0" max="999" value="${p.nivel ?? ''}" placeholder="—">
            <button type="button" class="btn" data-acao="nivel" data-delta="1" aria-label="Aumentar nível">+</button>
          </div>
        </section>
        <div class="abas-det" role="tablist">
          <button type="button" role="tab" data-acao="aba" data-aba="trilha" aria-selected="${aba === 'trilha'}">Trilha <small>${feitasT}/${t.length}</small></button>
          ${ORDEM_MODOS.map((m) => `<button type="button" role="tab" data-acao="aba" data-aba="${m}" aria-selected="${aba === m}">Mastery ${m} <small>${nM(m)}/${(app.dados.mastery[m] || []).length}</small></button>`).join('')}
        </div>`;
    }

    function corpo(a) {
      if (aba === 'trilha') {
        const nomesPend = a.militares.some((m) => m.nome_status === 'pendente');
        return `
          <h2 class="sec-tit">Militares <small>${a.militares.filter((m) => feita(app.estado, id, m.id)).length}/8</small>
            ${nomesPend ? '<span class="dica">por nível</span>' : ''}</h2>
          ${militaresHtml(a)}
          <h2 class="sec-tit">Especiais <small>${a.especiais.filter((c) => feita(app.estado, id, c.id)).length}/3</small></h2>
          <ul class="camos">${a.especiais.map((c) => camoHtml(a, c, c.id, 'especial')).join('')}</ul>
          <h2 class="sec-tit">Completionist</h2>
          <ul class="camos">${a.completionist.map((c) => camoHtml(a, c, c.id, c.id)).join('')}</ul>`;
      }
      const lista = app.dados.mastery[aba] || [];
      const min = app.dados.regras?.mastery_hb_minimo?.[aba];
      const info = min != null
        ? `Libera com Harmonic Break em ${min} armas (você tem ${contarHB(app.dados, app.estado)}).`
        : 'Pré-requisito a validar.';
      return `<p class="dica">${esc(info)} Sequencial: marcar uma marca as anteriores e a trilha toda desta arma.</p>
        <ul class="camos">${lista.map((m) => camoHtml(a, { ...m, desafio_modo: undefined }, chaveMastery(aba, m.id), 'mastery')).join('')}</ul>`;
    }

    function render() {
      const a = arma();
      cabecalho(a);
      $('[data-corpo]').innerHTML = corpo(a);
    }

    async function salvarERender() {
      render();
      await app.salvar();
    }

    // ---------- eventos ----------

    el.addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-acao]');
      if (!b) return;
      const a = arma();
      const chave = b.dataset.chave;
      switch (b.dataset.acao) {
        case 'sw': {
          const s = situacao(app.dados, app.estado, a, chave);
          if (s.bloqueada) { toast.mostrar(`Bloqueada — ${s.motivos.join(' · ')}`); return; }
          const antes = structuredClone(prog());
          const desfazer = { rotulo: 'Desfazer', fn: async () => { app.estado.armas[id] = antes; await salvarERender(); } };
          if (s.feita) {
            desmarcar(app.estado, a, chave);
            toast.mostrar(`Desmarcou ${b.getAttribute('aria-label')}`, desfazer);
          } else {
            const r = marcar(app.dados, app.estado, a, chave);
            // registra o modo ativo como o modo em que a camo foi feita, se ainda não houver
            const c = app.estado.armas[id].camos[chave];
            if (c && !c.modo && !chave.startsWith('militar')) c.modo = modo;
            toast.mostrar(r.marcadas.length > 1 ? `Marcou ${r.marcadas.length} camos (inclui as anteriores)` : `${b.getAttribute('aria-label')} ✓`, desfazer);
          }
          await salvarERender();
          el.querySelector(`[data-corpo] [data-chave="${CSS.escape(chave)}"], [data-cabecalho] [data-chave="${CSS.escape(chave)}"]`)?.classList.add('pulso');
          return;
        }
        case 'nivel': {
          const atual = prog().nivel ?? 0;
          return mudarNivel(atual + Number(b.dataset.delta));
        }
        case 'aba':
          aba = b.dataset.aba; prefs.gravar('aba-arma', aba); render(); return;
        case 'abrir-cont':
          abertos.has(chave) ? abertos.delete(chave) : abertos.add(chave); render(); return;
        case 'cont':
          if (!reg(chave).modo) definirModo(app.estado, a, chave, modo);
          ajustarContador(app.estado, a, chave, Number(b.dataset.delta)); return salvarERender();
        case 'modo':
          if (reg(chave).modo === b.dataset.modo) return;
          definirModo(app.estado, a, chave, b.dataset.modo); return salvarERender();
        case 'fav': {
          const f = app.estado.favoritas;
          app.estado.favoritas = f.includes(id) ? f.filter((x) => x !== id) : [...f, id];
          return salvarERender();
        }
      }
    });

    async function mudarNivel(n) {
      const marcadas = definirNivel(app.estado, arma(), n);
      if (marcadas.length) toast.mostrar(`Nível ${prog().nivel}: ${marcadas.length} Militar${marcadas.length > 1 ? 'es' : ''} marcada${marcadas.length > 1 ? 's' : ''}`);
      await salvarERender();
    }

    el.addEventListener('change', (ev) => {
      if (ev.target.id === 'nivel') mudarNivel(parseInt(ev.target.value, 10));
    });
    el.addEventListener('keydown', (ev) => {
      if (ev.target.id === 'nivel' && ev.key === 'Enter') ev.target.blur();
    });

    render();
    return () => toast.limpar();
  };
}
