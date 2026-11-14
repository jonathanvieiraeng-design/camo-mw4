// Editor de dados: corrige/completa o mw4.json pelo app. Tudo é salvo como "edição" (ver data.js),
// então o arquivo original nunca é alterado e o progresso continua ligado pelos ids.
import { esc, seloValidar, prefs } from '../ui.js';
import { aValidar, trilha, localizar, registrarEdicao, novaArma, removerEdicoes } from '../data.js';
import { normalizarBusca } from '../progresso.js';

const MODOS = ['MP', 'DMZ', 'WZ'];

// ---------- campos reutilizáveis ----------

const attrs = (chave, campo, tipo, sub) =>
  `data-chave="${esc(chave)}" data-campo="${campo}" data-tipo="${tipo}"${sub ? ` data-sub="${sub}"` : ''}`;

function campoTexto(rotulo, chave, campo, valor, { sub, placeholder = '' } = {}) {
  return `<label class="campo"><span>${rotulo}</span>
    <input type="text" value="${esc(valor ?? '')}" placeholder="${esc(placeholder)}" ${attrs(chave, campo, 'texto', sub)}></label>`;
}
function campoNumero(rotulo, chave, campo, valor, sub) {
  return `<label class="campo num"><span>${rotulo}</span>
    <input type="number" inputmode="numeric" min="0" value="${valor ?? ''}" placeholder="?" ${attrs(chave, campo, sub ? 'meta' : 'numero', sub)}></label>`;
}
function campoConfirmado(rotulo, chave, campo, valor) {
  return `<label class="marcador"><input type="checkbox" ${valor === 'confirmado' ? 'checked' : ''} ${attrs(chave, campo, 'status')}>
    <span>${rotulo}</span></label>`;
}
function opcoesCategoria(dados, atual) {
  return `<option value="" ${!atual ? 'selected' : ''}>Sem categoria</option>` +
    dados.categorias.map((c) => `<option value="${esc(c.id)}" ${atual === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('');
}
function opcoesLancamento(atual) {
  return [['', 'A definir', null], ['true', 'Lançamento', true], ['false', 'DLC', false]]
    .map(([v, r, b]) => `<option value="${v}" ${atual === b ? 'selected' : ''}>${r}</option>`).join('');
}

export function telaEditor(app, rota) {
  return (el) => {
    const [pagina, id] = rota;
    const editada = (chave) => !!app.estado.edicoes[chave];
    const btnRestaurar = (chave) => editada(chave)
      ? `<button type="button" class="link-btn" data-acao="restaurar" data-chave="${esc(chave)}">Restaurar original</button>` : '';

    // ---------- páginas ----------

    function indice() {
      const busca = prefs.ler('editor-busca', '');
      const termo = normalizarBusca(busca);
      const armas = [...app.dados.armas]
        .filter((a) => !termo || normalizarBusca(a.nome).includes(termo))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
      const pend = (a) => (a.categoria_status === 'pendente' ? 1 : 0) + trilha(a).filter(aValidar).length;
      return `<div class="pagina">
        <a class="voltar" href="#/config">‹ Configurações</a>
        <h1>Editor de dados</h1>
        <p class="dica">Preencha o que você confirmar no jogo. Suas edições ficam guardadas à parte e entram no backup.</p>
        <a class="btn cheio link-cheio" href="#/editor/mastery">Mastery e Divergence</a>
        <a class="btn cheio link-cheio" href="#/editor/nova">+ Adicionar arma</a>
        <input class="busca" style="width:100%;margin:12px 0 4px" type="search" placeholder="Buscar arma…" value="${esc(busca)}" data-acao="busca-editor">
        <ul class="linhas bloco">${armas.map((a) => `<li><a class="linha-btn" href="#/editor/arma/${encodeURIComponent(a.id)}">
          <span class="cat-nome">${esc(a.nome)} ${a.adicionada_pelo_usuario ? '<span class="selo dlc">sua</span>' : ''}</span>
          <span class="cat-txt">${esc(a.categoria ? app.dados.categorias.find((c) => c.id === a.categoria)?.nome ?? a.categoria : 'Sem categoria')}
            · ${pend(a) ? `<span class="aviso-txt">${pend(a)} a validar</span>` : '<span class="ok">tudo confirmado</span>'}</span></a></li>`).join('')}
        </ul></div>`;
    }

    function blocoCamo(armaId, c, tipo) {
      const chave = `camo:${armaId}:${c.id}`;
      const aberto = abertos.has(chave);
      let corpo = '';
      if (tipo === 'militar') {
        corpo = `<div class="grade2">${campoTexto('Nome', chave, 'nome', c.nome)}${campoNumero('Nível', chave, 'nivel', c.nivel)}</div>
          ${campoConfirmado('Nome confirmado', chave, 'nome_status', c.nome_status ?? 'confirmado')}
          ${campoConfirmado('Nível confirmado', chave, 'nivel_status', c.nivel_status ?? 'confirmado')}`;
      } else {
        const fixo = tipo !== 'especial'; // Gold/Platinum/Harmonic Break mantêm o nome
        corpo = `${fixo ? '' : campoTexto('Nome', chave, 'nome', c.nome)}
          ${fixo || !('nome_status' in c) ? '' : campoConfirmado('Nome confirmado', chave, 'nome_status', c.nome_status)}
          ${c.desafio_modo
            ? `<p class="grupo-titulo">Desafio por modo</p>${MODOS.map((m) => campoTexto(m, chave, 'desafio_modo', c.desafio_modo[m], { sub: m })).join('')}
               <button type="button" class="link-btn" data-acao="unificar" data-chave="${esc(chave)}">Usar o mesmo desafio nos 3 modos</button>`
            : `${campoTexto('Desafio', chave, 'desafio', c.desafio, { placeholder: 'ex.: Headshot kills' })}
               <button type="button" class="link-btn" data-acao="separar" data-chave="${esc(chave)}">O desafio muda por modo</button>`}
          <p class="grupo-titulo">Metas</p>
          <div class="grade3">${MODOS.map((m) => campoNumero(m, chave, 'meta', c.meta?.[m], m)).join('')}</div>
          ${campoConfirmado('Desafio e metas confirmados no jogo', chave, 'status', c.status)}`;
      }
      return `<details class="ed-camo" data-bloco="${esc(chave)}" ${aberto ? 'open' : ''}>
        <summary><span>${esc(c.nome)}</span>${aValidar(c) ? seloValidar() : ''}${editada(chave) ? '<span class="selo dlc">editada</span>' : ''}</summary>
        <div class="ed-corpo">${corpo}${btnRestaurar(chave)}</div></details>`;
    }

    function paginaArma() {
      const a = app.dados.armas.find((x) => x.id === id);
      if (!a) return `<div class="pagina"><a class="voltar" href="#/editor">‹ Editor</a><h1>Arma não encontrada</h1></div>`;
      const chave = `arma:${a.id}`;
      return `<div class="pagina editor">
        <div class="det-topo"><a class="voltar" href="#/editor">‹ Editor</a><a class="voltar" href="#/arma/${encodeURIComponent(a.id)}">Ver arma ›</a></div>
        <h1>${esc(a.nome)}</h1>
        <section class="bloco">
          ${campoTexto('Nome da arma', chave, 'nome', a.nome)}
          <label class="campo"><span>Categoria</span><select ${attrs(chave, 'categoria', 'categoria')}>${opcoesCategoria(app.dados, a.categoria)}</select></label>
          ${campoConfirmado('Categoria confirmada', chave, 'categoria_status', a.categoria_status)}
          <label class="campo"><span>Lançamento ou DLC</span><select ${attrs(chave, 'lancamento', 'lancamento')}>${opcoesLancamento(a.lancamento)}</select></label>
          ${campoNumero('Nível máximo da arma', chave, 'nivel_max', a.nivel_max)}
          ${btnRestaurar(chave)}
        </section>
        <h2>Militares</h2>${a.militares.map((c) => blocoCamo(a.id, c, 'militar')).join('')}
        <h2>Especiais</h2>${a.especiais.map((c) => blocoCamo(a.id, c, 'especial')).join('')}
        <h2>Completionist</h2>${a.completionist.map((c) => blocoCamo(a.id, c, c.id)).join('')}
        ${a.adicionada_pelo_usuario ? `<h2>Zona de perigo</h2>
          <button type="button" class="btn cheio perigo" data-acao="remover-arma">Remover esta arma</button>
          <p class="dica">O progresso dela fica guardado (não é apagado).</p>` : ''}
      </div>`;
    }

    function paginaMastery() {
      const item = (chave, m) => `<details class="ed-camo" data-bloco="${esc(chave)}" ${abertos.has(chave) ? 'open' : ''}>
        <summary><span>${esc(m.nome)}</span>${aValidar(m) ? seloValidar() : ''}${editada(chave) ? '<span class="selo dlc">editada</span>' : ''}</summary>
        <div class="ed-corpo">${campoTexto('Nome', chave, 'nome', m.nome)}
          ${campoTexto('Desafio', chave, 'desafio', m.desafio, { placeholder: 'ex.: Get 10 Kills in a match 250 times' })}
          ${campoConfirmado('Confirmado no jogo', chave, 'status', m.status)}${btnRestaurar(chave)}</div></details>`;
      return `<div class="pagina editor">
        <a class="voltar" href="#/editor">‹ Editor</a>
        <h1>Mastery e Divergence</h1>
        <p class="dica">O número de Harmonic Break que libera cada Mastery fica no arquivo de dados (regras).</p>
        <h2>Divergence</h2>${item('divergence', app.dados.divergence)}
        ${Object.entries(app.dados.mastery).map(([modo, lista]) =>
          `<h2>Mastery ${esc(modo)}</h2>${lista.map((m) => item(`mastery:${modo}:${m.id}`, m)).join('')}`).join('')}
      </div>`;
    }

    function paginaNova() {
      return `<div class="pagina editor">
        <a class="voltar" href="#/editor">‹ Editor</a>
        <h1>Adicionar arma</h1>
        <form data-form="nova" class="bloco">
          <label class="campo"><span>Nome</span><input name="nome" type="text" required autocomplete="off"></label>
          <label class="campo"><span>Categoria</span><select name="categoria">${opcoesCategoria(app.dados, null)}</select></label>
          <label class="campo"><span>Lançamento ou DLC</span><select name="lancamento">${opcoesLancamento(false)}</select></label>
          <p class="dica">A arma é criada com 8 Militares, 3 Especiais, Gold, Platinum e Harmonic Break, tudo "a validar". Depois é só preencher.</p>
          <button type="submit" class="btn cheio">Criar arma</button>
        </form></div>`;
    }

    // ---------- render e eventos ----------

    const abertos = new Set();
    let timer = null;
    function render() {
      el.querySelectorAll('details[open]').forEach((d) => abertos.add(d.dataset.bloco));
      const html = pagina === 'arma' ? paginaArma() : pagina === 'mastery' ? paginaMastery()
        : pagina === 'nova' ? paginaNova() : indice();
      el.innerHTML = html + '<div class="toast" role="status" hidden><span data-toast-txt></span></div>';
    }
    function toast(t) {
      const box = el.querySelector('.toast');
      el.querySelector('[data-toast-txt]').textContent = t;
      box.hidden = false; clearTimeout(timer); timer = setTimeout(() => { box.hidden = true; }, 1800);
    }
    async function editar(chave, campos, rerender = false) {
      registrarEdicao(app.estado, app.bruto, chave, campos);
      await app.salvar();
      toast('Salvo');
      if (rerender) render();
    }

    function valorDe(input) {
      const t = input.dataset.tipo;
      const atual = localizar(app.dados, input.dataset.chave);
      const num = () => (input.value === '' ? null : Math.max(0, parseInt(input.value, 10) || 0));
      switch (t) {
        case 'texto': {
          if (input.dataset.sub) return { ...(atual.desafio_modo || {}), [input.dataset.sub]: input.value.trim() };
          return input.value.trim();
        }
        case 'numero': return num();
        case 'meta': {
          const m = { MP: null, DMZ: null, WZ: null, ...(atual.meta || {}), [input.dataset.sub]: num() };
          return MODOS.every((k) => m[k] == null) ? null : m;
        }
        case 'status': return input.checked ? 'confirmado' : 'pendente';
        case 'categoria': return input.value || null;
        case 'lancamento': return input.value === '' ? null : input.value === 'true';
        default: return input.value;
      }
    }

    el.addEventListener('change', async (ev) => {
      const inp = ev.target;
      if (!inp.dataset.chave) return;
      const { chave, campo } = inp.dataset;
      if (campo === 'nome' && !inp.value.trim()) { toast('O nome não pode ficar vazio'); render(); return; }
      const campos = { [campo]: valorDe(inp) };
      // escolher categoria já marca como confirmada (dá para desmarcar)
      if (campo === 'categoria') {
        campos.categoria_status = campos.categoria ? 'confirmado' : 'pendente';
        const cb = el.querySelector(`[data-chave="${CSS.escape(chave)}"][data-campo="categoria_status"]`);
        if (cb) cb.checked = !!campos.categoria;
      }
      await editar(chave, campos, campo === 'nome' || campo.endsWith('status'));
    });

    el.addEventListener('input', (ev) => {
      if (ev.target.dataset.acao === 'busca-editor') {
        prefs.gravar('editor-busca', ev.target.value);
        const pos = ev.target.selectionStart;
        render();
        const b = el.querySelector('[data-acao="busca-editor"]');
        b.focus(); b.setSelectionRange(pos, pos);
      }
    });

    el.addEventListener('click', async (ev) => {
      const b = ev.target.closest('button[data-acao]');
      if (!b) return;
      const chave = b.dataset.chave;
      if (b.dataset.acao === 'restaurar') {
        removerEdicoes(app.estado, (k) => k === chave);
        await app.salvar(); toast('Restaurado'); render();
      }
      if (b.dataset.acao === 'separar') {
        const c = localizar(app.dados, chave);
        await editar(chave, { desafio_modo: { MP: c.desafio || '', DMZ: c.desafio || '', WZ: c.desafio || '' }, desafio: 'Varia por modo' }, true);
      }
      if (b.dataset.acao === 'unificar') {
        const c = localizar(app.dados, chave);
        await editar(chave, { desafio: c.desafio_modo?.MP || '', desafio_modo: null }, true);
      }
      if (b.dataset.acao === 'remover-arma') {
        const a = app.dados.armas.find((x) => x.id === id);
        if (!confirm(`Remover "${a.nome}"? O progresso dela fica guardado.`)) return;
        app.estado.armas_novas = app.estado.armas_novas.filter((x) => x.id !== id);
        removerEdicoes(app.estado, (k) => k === `arma:${id}` || k.startsWith(`camo:${id}:`));
        await app.salvar();
        location.hash = '#/editor';
      }
    });

    el.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = new FormData(ev.target);
      const nome = String(f.get('nome') || '').trim();
      if (!nome) return;
      const lanc = f.get('lancamento');
      const arma = novaArma(app.dados, nome, f.get('categoria') || null, lanc === '' ? null : lanc === 'true');
      app.estado.armas_novas.push(arma);
      await app.salvar();
      location.hash = `#/editor/arma/${encodeURIComponent(arma.id)}`;
    });

    render();
    scrollTo(0, 0);
    return () => clearTimeout(timer);
  };
}
