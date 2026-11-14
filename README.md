# Camo MW4 — Rastreador de Camuflagens

App pessoal (PWA) para acompanhar à mão o progresso de camuflagens das armas do MW4 nos modos
Multiplayer, DMZ e Warzone. Sem login, sem servidor, funciona 100% offline depois de instalado.

Projeto de fã, sem relação com os donos do jogo. Nenhuma arte do jogo é usada.

## Instalar no celular

1. Abra o endereço do GitHub Pages no navegador do celular (Chrome no Android, Safari no iPhone).
2. **Android:** menu ⋮ → *Instalar app* (ou *Adicionar à tela inicial*).
   **iPhone:** botão Compartilhar → *Adicionar à Tela de Início*.
3. Abra pelo ícone uma vez com internet. A partir daí funciona em modo avião.

> Faça **Config → Exportar backup** de vez em quando. Se o navegador limpar os dados do site,
> **Importar backup** restaura tudo (progresso, favoritas, configurações e edições).

## Estrutura

```
index.html              página única do app
manifest.webmanifest    nome, ícones e cores para instalar
sw.js                   service worker (cache offline)
data/mw4.json           TODO o conteúdo do jogo (armas, camos, desafios, regras)
css/app.css             estilos (mobile-first, tema escuro)
js/store.js             persistência (IndexedDB) e backup
js/data.js              carrega mw4.json e aplica as edições feitas no app
js/rules.js             regras de progressão (travas, cascata, nível)
js/progresso.js         resumo por arma, filtros e ordenação da lista
js/stats.js             números do Painel
js/views/*.js           telas: lista, arma, painel, config, editor
tests/                  testes automáticos (abra /tests/ no navegador)
tools/servidor.ps1      servidor local para testar no PC (Windows)
```

## Atualizar os dados do jogo

- Edite `data/mw4.json` e publique. O app busca a versão nova quando houver internet.
- O progresso **não** se perde: ele é ligado pelo `id` da arma e da camo. Não mude ids existentes.
- Se a versão nova mudar algo que você já tinha editado no app, a **sua** edição continua valendo e
  aparece em **Config → Dados novos disponíveis** para você escolher.
- Itens com `"status": "pendente"` aparecem com o selo **a validar**.
- Regras configuráveis ficam em `regras` (ex.: `divergence_hb_minimo`, `mastery_hb_minimo`).

## Atualizar o código

Ao mudar qualquer arquivo de código (HTML, CSS ou JS), **aumente `VERSAO` em `sw.js`** (ex.: `v1` → `v2`)
e, se criou arquivo novo, inclua-o na lista `ARQUIVOS`. O app mostra "Nova versão disponível → Atualizar".

## Testar no PC (Windows)

```
powershell -ExecutionPolicy Bypass -File tools/servidor.ps1
```

Abra http://localhost:8080 (o app) e http://localhost:8080/tests/ (testes).

## Publicar no GitHub Pages

Repositório → *Settings* → *Pages* → *Source: Deploy from a branch* → branch `main`, pasta `/ (root)`.
O endereço fica `https://<usuario>.github.io/<repositorio>/`.
