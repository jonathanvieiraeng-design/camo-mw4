// Detalhe da arma: nível, trilha de camos e Mastery por modo.
import { esc, prefs, seloValidar } from '../ui.js';
import { aValidar, trilha } from '../data.js';
import { chaveMastery } from '../progresso.js';
import { situacao, marcar, desmarcar, definirNivel, proximaMilitar, ajustarContador, definirModo,
  contarHB, feita } from '../rules.js';

const MODOS = ['MP', 'DMZ', 'WZ'];
const ABAS_MASTERY = ['MP', 'WZ', 'DMZ'];

export function telaArma(app, id) {
  return (el) => {
    const arma = () => app.dados.armas.find((a) => a.id === id);
    if (!arma()) {
      el.innerHTML = `<div class="pagina"><a class="voltar" href="#/armas">‹ Armas</a>
        <h1>Arma não encontrada</h1></div>`;
      return;
    }
    let aba = prefs.ler('aba-arma', 'trilha');
    const abertos = new Set(); // contadores expandidos
    let desfazer = null;
    let timerToast = null;

    el.innerHTML = `<div class="pagina detalhe">
      <div class="det-topo"><a class="voltar" href="#/armas">‹ Armas</a>
        <span><a class="voltar" href="#/editor/arma/${encodeURIComponent(id)}">Editar dados</a>
        <button type="button" class="fav" data-acao="fav"></button></span></div>
      <div data-cabecalho></div>
      <div data-corpo></div>
    </div>
    <div class="toast" role="status" hidden><span data-toast-txt></span>
      <button type="button" class="link-btn" data-acao="desfazer" hidden>Desfazer</button></div>`;
    scrollTo(0, 0);

    const $ = (s) => el.querySelector(s);
    const prog = () => app.estado.armas[id] || { nivel: null, camos: {} };
    const reg = (k) => prog().camos[k] || {};

    function toast(texto, podeDesfazer = false) {
      $('[data-toast-txt]').textContent = texto;
      $('[data-acao="desfazer"]').hidden = !podeDesfazer;
      $('.toast').hidden = false;
      clearTimeout(timerToast);
      timerToast = setTimeout(() => { $('.toast').hidden = true; desfazer = null; }, podeDesfazer ? 6000 : 3500);
    }

    // ---------- pedaços de HTML ----------

    function metasHtml(c, modoSel) {
      if (c.desafio_modo) {
        return `<ul class="metas-modo">${MODOS.map((m) => `<li class="${modoSel === m ? 'sel' : ''}"><b>${m}</b>
          <span>${c.desafio_modo[m] ? esc(c.desafio_modo[m]) : '<i>a validar</i>'}</span>
          <span class="num">${c.meta?.[m] ?? '?'}</span></li>`).join('')}</ul>`;
      }
      if (!c.meta) return '<div class="metas"><i>Metas a validar</i></div>';
      return `<div class="metas">${MODOS.map((m) =>
        `<span class="${modoSel === m ? 'sel' : ''}"><b>${m}</b> ${c.meta[m] ?? '?'}</span>`).join('')}</div>`;
    }

    function contadorHtml(chave, meta) {
      const r = reg(chave);
      const alvo = r.modo && meta ? meta[r.modo] : null;
      const valor = r.contador ?? 0;
      const rotulo = r.contador == null && !r.modo ? 'Contador' :
        `Contador: ${valor}${alvo != null ? `/${alvo}` : ''}${r.modo ? ` (${r.modo})` : ''}`;
      const aberto = abertos.has(chave);
      return `<button type="button" class="contador-toggle ${alvo != null && valor >= alvo ? 'atingido' : ''}"
          data-acao="abrir-cont" data-chave="${esc(chave)}" aria-expanded="${aberto}">${esc(rotulo)} ${aberto ? '▴' : '▾'}</button>
        ${aberto ? `<div class="contador">
          <div class="segmentado modos" role="group" aria-label="Modo">${MODOS.map((m) =>
            `<button type="button" data-acao="modo" data-chave="${esc(chave)}" data-modo="${m}" aria-pressed="${r.modo === m}">${m}</button>`).join('')}</div>
          <div class="passos">
            <button type="button" class="btn" data-acao="cont" data-chave="${esc(chave)}" data-delta="-5">−5</button>
            <button type="button" class="btn" data-acao="cont" data-chave="${esc(chave)}" data-delta="-1">−1</button>
            <output>${valor}${alvo != null ? `<small>/${alvo}</small>` : ''}</output>
            <button type="button" class="btn" data-acao="cont" data-chave="${esc(chave)}" data-delta="1">+1</button>
            <button type="button" class="btn" data-acao="cont" data-chave="${esc(chave)}" data-delta="5">+5</button>
          </div>
          ${alvo != null && valor >= alvo && !r.ok ? '<p class="dica">Meta atingida — toque no quadrado para marcar.</p>' : ''}
        </div>` : ''}`;
    }

    function checkHtml(chave, s, nome) {
      const rot = s.bloqueada ? `${nome}: bloqueada` : nome;
      return `<button type="button" class="check" role="checkbox" aria-checked="${s.feita}"
        aria-disabled="${s.bloqueada}" aria-label="${esc(rot)}" data-acao="check" data-chave="${esc(chave)}">${
        s.feita ? '✓' : s.bloqueada ? '🔒' : ''}</button>`;
    }

    function camoHtml(a, c, chave, { comDesafio = true } = {}) {
      const s = situacao(app.dados, app.estado, a, chave);
      const r = reg(chave);
      const desafio = c.desafio ? (c.desafio_modo ? '' : esc(c.desafio)) : '<i>Desafio a validar</i>';
      return `<li class="camo ${s.feita ? 'feita' : ''} ${s.bloqueada ? 'bloqueada' : ''}">
        ${checkHtml(chave, s, c.nome)}
        <div class="camo-corpo">
          <div class="camo-nome">${esc(c.nome)} ${aValidar(c) ? seloValidar() : ''}
            ${s.feita && r.modo ? `<span class="modo-feito">${r.modo}</span>` : ''}</div>
          ${comDesafio && desafio ? `<div class="camo-desafio">${desafio}</div>` : ''}
          ${comDesafio && c.meta !== undefined ? metasHtml(c, r.modo) : ''}
          ${s.motivos.length && !s.feita ? `<ul class="motivos ${s.bloqueada ? '' : 'livre'}">${s.motivos.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
          ${comDesafio ? contadorHtml(chave, c.meta) : ''}
        </div>
      </li>`;
    }

    function militarHtml(a, m) {
      const s = situacao(app.dados, app.estado, a, m.id);
      return `<li class="camo militar ${s.feita ? 'feita' : ''}">
        ${checkHtml(m.id, s, m.nome)}
        <div class="camo-corpo linha"><span class="camo-nome">${esc(m.nome)}</span>
          <span class="nivel-req">${m.nivel != null ? `Nv ${m.nivel}` : 'Nv ?'}</span></div>
      </li>`;
    }

    function cabecalho(a) {
      const cat = a.categoria ? esc(app.dados.categorias.find((c) => c.id === a.categoria)?.nome ?? a.categoria) : 'Sem categoria';
      const p = prog();
      const prox = proximaMilitar(app.estado, a);
      const fav = app.estado.favoritas.includes(id);
      const btnFav = $('[data-acao="fav"]');
      btnFav.textContent = fav ? '★' : '☆';
      btnFav.setAttribute('aria-pressed', fav);
      btnFav.setAttribute('aria-label', fav ? 'Remover dos favoritos' : 'Favoritar');
      const feitasT = trilha(a).filter((c) => feita(app.estado, id, c.id)).length;
      const nM = (modo) => (app.dados.mastery[modo] || []).filter((m) => feita(app.estado, id, chaveMastery(modo, m.id))).length;
      $('[data-cabecalho]').innerHTML = `
        <h1>${esc(a.nome)}</h1>
        <div class="card-sub"><span>${cat}</span>${a.categoria_status === 'pendente' ? seloValidar() : ''}
          ${a.lancamento === false ? '<span class="selo dlc">DLC</span>' : ''}</div>
        <section class="nivel-arma">
          <label for="nivel">Nível da arma</label>
          <div class="passos">
            <button type="button" class="btn" data-acao="nivel" data-delta="-1" aria-label="Diminuir nível">−</button>
            <input id="nivel" type="number" inputmode="numeric" min="0" max="999" value="${p.nivel ?? ''}" placeholder="—">
            <button type="button" class="btn" data-acao="nivel" data-delta="1" aria-label="Aumentar nível">+</button>
          </div>
          <p class="dica">${prox ? `Próxima Militar no nível ${prox.nivel}` :
            a.militares.some((m) => m.nivel == null) ? 'Níveis das Militares a validar — marque manualmente.' : 'Todas as Militares obtidas.'}</p>
        </section>
        <div class="segmentado abas-det" role="tablist">
          <button type="button" role="tab" data-acao="aba" data-aba="trilha" aria-pressed="${aba === 'trilha'}">Trilha ${feitasT}/${trilha(a).length}</button>
          ${ABAS_MASTERY.map((m) => `<button type="button" role="tab" data-acao="aba" data-aba="${m}" aria-pressed="${aba === m}">${m} ${nM(m)}/${(app.dados.mastery[m] || []).length}</button>`).join('')}
        </div>`;
    }

    function corpo(a) {
      if (aba === 'trilha') {
        const nomesPend = a.militares.some((m) => m.nome_status === 'pendente');
        return `
          <h2>Militares ${nomesPend ? '<span class="selo validar">nomes a validar</span>' : ''}</h2>
          <ul class="camos">${a.militares.map((m) => militarHtml(a, m)).join('')}</ul>
          <h2>Especiais</h2>
          <ul class="camos">${a.especiais.map((c) => camoHtml(a, c, c.id)).join('')}</ul>
          <h2>Completionist</h2>
          <ul class="camos">${a.completionist.map((c) => camoHtml(a, c, c.id)).join('')}</ul>`;
      }
      const lista = app.dados.mastery[aba] || [];
      const min = app.dados.regras?.mastery_hb_minimo?.[aba];
      const info = min != null
        ? `Libera com Harmonic Break em ${min} armas (você tem ${contarHB(app.dados, app.estado)}).`
        : 'Pré-requisito a validar.';
      return `<p class="dica">${esc(info)} Sequencial: marcar uma marca as anteriores e a trilha toda desta arma.</p>
        <ul class="camos">${lista.map((m) => camoHtml(a, m, chaveMastery(aba, m.id))).join('')}</ul>`;
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
        case 'check': {
          const s = situacao(app.dados, app.estado, a, chave);
          if (s.bloqueada) { toast(`Bloqueada — ${s.motivos.join(' · ')}`); return; }
          const antes = structuredClone(prog());
          if (s.feita) {
            desmarcar(app.estado, a, chave);
          } else {
            const r = marcar(app.dados, app.estado, a, chave);
            if (r.marcadas.length > 1) {
              desfazer = antes;
              toast(`Marcou ${r.marcadas.length} camos (inclui as anteriores)`, true);
            }
          }
          return salvarERender();
        }
        case 'desfazer':
          if (desfazer) { app.estado.armas[id] = desfazer; desfazer = null; $('.toast').hidden = true; await salvarERender(); }
          return;
        case 'nivel': {
          const atual = prog().nivel ?? 0;
          return mudarNivel(atual + Number(b.dataset.delta));
        }
        case 'aba':
          aba = b.dataset.aba; prefs.gravar('aba-arma', aba); render(); return;
        case 'abrir-cont':
          abertos.has(chave) ? abertos.delete(chave) : abertos.add(chave); render(); return;
        case 'cont':
          ajustarContador(app.estado, a, chave, Number(b.dataset.delta)); return salvarERender();
        case 'modo':
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
      if (marcadas.length) toast(`Nível ${prog().nivel}: ${marcadas.length} Militar${marcadas.length > 1 ? 'es' : ''} marcada${marcadas.length > 1 ? 's' : ''}`);
      await salvarERender();
    }

    el.addEventListener('change', (ev) => {
      if (ev.target.id === 'nivel') mudarNivel(parseInt(ev.target.value, 10));
    });
    el.addEventListener('keydown', (ev) => {
      if (ev.target.id === 'nivel' && ev.key === 'Enter') ev.target.blur();
    });

    render();
    return () => clearTimeout(timerToast);
  };
}
