// Configurações: modo livre, backup, conflitos de dados, editor e zona de perigo.
import { baixarBackup, lerBackup, semProgresso } from '../store.js';
import { aceitarDadoNovo, manterMinhaEdicao, descreverChave, progressoOrfao } from '../data.js';
import { esc } from '../ui.js';

const mostrar = (v) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

export function telaConfig(app) {
  return (el) => {
    const marcadas = Object.values(app.estado.armas).reduce((n, p) => n + Object.values(p.camos).filter((c) => c.ok).length, 0);
    const nEdicoes = Object.keys(app.estado.edicoes).length + app.estado.armas_novas.length;
    const pers = app.persistente === true ? 'ativa' : app.persistente === false ? 'negada pelo navegador' : 'sem suporte';
    const orfas = progressoOrfao(app.estado, app.dados);
    const livre = !!app.estado.config.modo_livre;

    el.innerHTML = `<div class="pagina">
      <h1>Configurações</h1>

      <label class="interruptor">
        <span><b>Modo livre</b><br><span class="dica">Desliga as travas de Platinum, Harmonic Break, Mastery e Divergence. Use se a regra do jogo for diferente da cadastrada.</span></span>
        <input type="checkbox" data-acao="livre" ${livre ? 'checked' : ''}>
      </label>

      ${app.conflitos.length ? `<h2>Dados novos disponíveis</h2>
        <p class="dica">O arquivo de dados mudou em itens que você editou. Sua edição continua valendo até você decidir.</p>
        <ul class="linhas bloco">${app.conflitos.map((c, i) => `<li class="conflito">
          <b>${esc(descreverChave(app.dados, c.chave))}</b> · ${esc(c.campo)}
          <div class="dica">Seu: <b>${esc(mostrar(c.seu))}</b> · Arquivo: <b>${esc(mostrar(c.novo))}</b></div>
          <div class="acoes"><button class="btn" data-acao="usar-novo" data-i="${i}">Usar do arquivo</button>
            <button class="btn" data-acao="manter" data-i="${i}">Manter o meu</button></div></li>`).join('')}</ul>` : ''}

      ${app.avisos.length || orfas.length ? `<h2>Avisos</h2><ul class="linhas bloco">
        ${app.avisos.map((a) => `<li class="conflito dica">${esc(a.texto)}</li>`).join('')}
        ${orfas.length ? `<li class="conflito dica">Progresso guardado de armas que não estão mais nos dados: ${esc(orfas.join(', '))}. Ele não foi apagado.</li>` : ''}
      </ul>` : ''}

      <h2>Dados do jogo</h2>
      <dl class="info">
        <dt>Versão dos dados</dt><dd>v${esc(app.dados.versao_dados)} · ${app.dados.armas.length} armas</dd>
        <dt>Suas edições</dt><dd>${nEdicoes}</dd>
      </dl>
      <a class="btn cheio link-cheio" href="#/editor">Abrir editor de dados</a>

      <h2>Backup</h2>
      <dl class="info">
        <dt>Camos marcadas</dt><dd>${marcadas}</dd>
        <dt>Armazenamento</dt><dd>${esc(app.store.tipo)}</dd>
        <dt>Proteção contra limpeza</dt><dd>${pers}</dd>
      </dl>
      <p class="dica">O backup inclui progresso, favoritas, configurações e suas edições de dados.</p>
      <button class="btn cheio" data-acao="exportar">Exportar backup (JSON)</button>
      <label class="btn cheio link-cheio">Importar backup
        <input type="file" accept="application/json,.json" hidden data-acao="importar"></label>


      <h2>Zona de perigo</h2>
      <button class="btn cheio perigo" data-acao="zerar">Zerar progresso</button>
      <p class="dica">Apaga camos, níveis, contadores e favoritas. Mantém suas edições de dados.</p>
      <button class="btn cheio perigo" data-acao="restaurar" ${nEdicoes ? '' : 'disabled'}>Apagar minhas edições de dados</button>
      <p class="dica">Volta ao arquivo de dados original (inclui remover armas que você adicionou). Mantém o progresso.</p>

      <p class="dica" style="margin-top:24px">Camo MW4 · uso pessoal · <a href="tests/">testes automáticos</a></p>
    </div>`;

    const recarregar = () => dispatchEvent(new HashChangeEvent('hashchange'));
    const confirmar2 = (a, b) => confirm(a) && confirm(b);

    el.addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-acao]');
      const acao = b?.dataset.acao;
      if (!acao || b.tagName === 'INPUT') return;
      if (acao === 'exportar') baixarBackup(app.estado, app.bruto.versao_dados);
      if (acao === 'zerar') {
        if (!confirmar2('Apagar TODO o progresso?', 'Tem certeza? Só dá para recuperar com um backup.')) return;
        await app.substituirEstado(semProgresso(app.estado));
        recarregar();
      }
      if (acao === 'restaurar') {
        if (!confirmar2('Apagar todas as suas edições de dados?', 'Tem certeza? Categorias, nomes e desafios que você preencheu serão perdidos.')) return;
        app.estado.edicoes = {};
        app.estado.armas_novas = [];
        await app.salvar();
        recarregar();
      }
      if (acao === 'usar-novo' || acao === 'manter') {
        const c = app.conflitos[Number(b.dataset.i)];
        if (acao === 'usar-novo') aceitarDadoNovo(app.estado, c.chave, c.campo);
        else manterMinhaEdicao(app.estado, app.bruto, c.chave, c.campo);
        await app.salvar();
        recarregar();
      }
    });

    el.addEventListener('change', async (ev) => {
      const acao = ev.target.dataset.acao;
      if (acao === 'livre') {
        app.estado.config.modo_livre = ev.target.checked;
        await app.salvar();
      }
      if (acao === 'importar') {
        const arq = ev.target.files[0];
        if (!arq) return;
        try {
          await app.substituirEstado(lerBackup(await arq.text()));
          alert('Backup importado.');
          recarregar();
        } catch (e) { alert(e.message); }
        ev.target.value = '';
      }
    });
  };
}

