<div align="center">

# R.A.I.L.D.A

### Recuperação Ampliada de Informação e Logística de Dados e Armazenamento

**Um sistema de biblioteca livre, feito para ser copiado, melhorado e compartilhado.**

`Acervo` · `Catalogação MARC21` · `Empréstimos` · `Etiquetas` · `Desbaste` · `Feed social de leitores` · `Importação do Biblivre` · `Funciona no PC e no celular`

</div>

---

## 📚 Por que o R.A.I.L.D.A existe

Quase toda biblioteca pequena — de escola, de bairro, de igreja, de associação, de empresa — passa pelo mesmo problema: **o acervo existe, mas o sistema para cuidar dele é caro, complicado ou simplesmente não cabe no orçamento.** Planilhas se perdem, cadernos de empréstimo somem, e ninguém sabe ao certo quais livros a biblioteca tem.

O R.A.I.L.D.A nasceu para mudar isso. Ele é:

- **Simples de hospedar** — roda no navegador (HTML, CSS e JavaScript puros) e guarda os dados no Supabase, que tem plano gratuito.
- **Completo o bastante para o dia a dia** — consulta, catalogação em MARC21, empréstimos, reservas, etiquetas, desbaste, relatórios e até um feed onde os leitores conversam sobre livros.
- **Feito para o celular e para o PC**, porque o bibliotecário atende no balcão e o leitor consulta no ônibus.
- **Livre.** Qualquer pessoa pode usar, estudar, copiar e adaptar — com **uma única condição**: quem melhorar o sistema devolve a sua versão para todos (veja [Software livre](#-software-livre-e-a-regra-de-ouro)).

> Se uma biblioteca de escola em uma cidade pequena consegue ter um sistema decente, a leitura ganha. É por isso que isto é aberto.

---

## ✨ O que o sistema faz

| Para quem | O que encontra |
|---|---|
| **Leitor** | Consulta do acervo com capas, busca avançada, reservas, favoritos, feed social, estante de leituras com estatísticas de páginas, chat e clubes de leitura, perfil com foto e bio |
| **Estagiário** | Tudo do leitor + catalogação, empréstimos, reservas, etiquetas, desbaste e moderação do feed |
| **Bibliotecário** | Tudo do estagiário + gestão de usuários, relatórios, importar/exportar a base, personalização visual (white-label) e caixa de mensagens do suporte |

Há três cargos no banco de dados: `usuario`, `estagiario` e `bibliotecario`. O menu mostra só o que cada um pode usar.

---

## 🧭 Passo a passo de uso

### 1. Primeiros passos (todo mundo)

1. **Abra o sistema** no navegador (PC ou celular). A tela inicial é o **Acervo** e pode ser consultada sem login.
2. **Crie sua conta** em *Entrar / Login → Criar conta*. Preencha nome completo, usuário, e-mail, senha (mínimo 8 caracteres) e aceite as regras de convivência. Se algo estiver errado, o formulário mostra o motivo.
3. **Entre** com seu usuário e senha.
4. Toque no **botão de usuário** (canto superior direito) para ver seu cargo, abrir o **Suporte e ajuda** ou **alternar entre tema claro e escuro**.
5. No celular, o menu **Acervo · Catalogação · Gestão** fica fixo embaixo da tela.

> 💡 O nome completo do sistema aparece ao passar o mouse sobre "R.A.I.L.D.A" no topo.

### 2. Para leitores

#### 🔍 Acervo — encontrando livros
- A tela inicial mostra **50 obras aleatórias, com capa**, como uma vitrine de descobertas. Chegou ao fim? Toque em **Mostrar outras 50 obras** para sortear outras.
- **Clique (ou toque) na capa** de um livro para abrir a **CIP** (ficha catalográfica) dele.
- Para achar uma obra específica, use a **busca avançada**: escolha o critério (*Título, Autor, Assunto, ISBN, Editora, Código de chamada/CDD, Ano ou Todos os campos*) e digite. Combine com os filtros **Disponíveis/Emprestados**, **Tipo de material** e **Idioma**. O botão **Limpar tudo** volta à vitrine.
- Na busca, os resultados aparecem de 50 em 50, com o botão **Mostrar mais**.
- Você pode trocar a visão entre **Capas**, **Lista** e **Prateleira**.
- Em cada livro: **Reservar**, **Favoritar** (coração) e **CIP**.

#### 🏠 Minha Área (aba Acervo → barra superior)
- **Feed** — publique resenhas, citações e recomendações. Dá para anexar **até 4 fotos/GIFs** e **até 5 livros** (do acervo ou de fora). Curta, comente, denuncie conteúdo impróprio. Posts com palavrões, links ou fotos passam pela moderação antes de aparecer.
- **Leituras** — sua estante pessoal:
  1. Toque em **Adicionar livro** e escolha *Do acervo* ou *Livro externo*. No externo, digite o título ou o ISBN e o sistema busca **capa, autor e nº de páginas** automaticamente. Se não achar a capa, **tire uma foto** ou envie uma imagem.
  2. Em *Lendo agora*, informe **em qual página parou**. O sistema calcula sozinho as páginas do dia (ex.: da 98 para a 150 = **52 páginas**).
  3. Acompanhe os cartões: livros lidos no mês/semestre/ano, páginas hoje × ontem, média por dia e **sequência de dias seguidos lendo**.
  4. Toque em **Publicar no Feed** para compartilhar seu progresso, com comentário, figurinha ou GIF.
- **Favoritos** e **Reservas** — seus livros salvos e o andamento dos pedidos (você pode cancelar uma reserva pendente).
- **Chat** — converse com outros usuários ou crie **clubes de leitura**. Em cada conversa há opções para **limpar** (só para você ou para todos) e **excluir/sair**.
- **Perfil** — foto, bio, cidade, livro favorito e gêneros preferidos, com pré-visualização.

#### 🆘 Suporte
No menu do usuário, abra **Suporte e ajuda**: escolha o assunto, descreva o problema e acompanhe a resposta da equipe em *Minhas mensagens*. Há também perguntas frequentes.

### 3. Para estagiários e bibliotecários — Catalogação

A aba **Catalogação** reúne o trabalho de balcão:

| Aba | Como usar |
|---|---|
| **Catalogar** | Preencha a planilha MARC21 (título, autor, CDD, ISBN, assunto, exemplares…). Use **Buscar capa na internet** para trazer a capa pelo ISBN ou pelo título e autor. |
| **Empréstimos** | **1)** escolha o livro (busca por título, autor ou tombo) · **2)** escolha o leitor · **3)** defina o prazo (7, 14, 21 ou 30 dias). O sistema avisa exemplares disponíveis, reservas de outras pessoas e atrasos do leitor. Na lista, **renove (+7 dias)** ou **devolva**; atrasos aparecem em destaque. |
| **Reservas** | Veja as reservas pendentes e atenda ou cancele. |
| **Etiquetas** | Pesquise (ou use *Recém-catalogados*), selecione os livros e defina quantas etiquetas de cada. Ajuste **margens, tamanho e posição de cada informação** na folha A4, veja a **pré-visualização** e gere o **PDF** com código de barras. Dá para começar numa etiqueta específica para reaproveitar folhas. |
| **Desbaste** ☁️ | Localize o livro, escolha o **motivo** (*falta de espaço, desatualizado, avariado, permuta ou doação*), informe o **destino** (em permuta/doação) e escreva a **observação**. O registro fica guardado para estatísticas, mesmo depois que o livro sai do acervo. Há histórico, filtros e exportação em CSV. |

**Moderação do feed** — em *Minha Área*, a aba **Moderação** lista posts retidos e denunciados. Aprove, ou remova informando o motivo.

### 4. Para bibliotecários — Gestão

| Aba | Para que serve |
|---|---|
| **Usuários** | Cadastrar e gerir leitores, estagiários e bibliotecários. |
| **Relatórios** | Entrada de livros, novos usuários, empréstimos, reservas, desbastes por motivo, tudo com período de 3, 6 ou 12 meses e exportação em CSV. |
| **Dados** | **Importar e exportar a base**, buscar capas em lote e apagar importações (detalhes abaixo). |
| **Personalização** | Deixe o sistema com a cara da sua biblioteca: **nome, logotipos, favicon, cores, fonte e arredondamento**. Salvar exige a sua senha. Há botão *Restaurar padrão*. |
| **Mensagens** | Responda os pedidos de suporte dos usuários. |

### 5. Trazendo a base de outro sistema (ex.: Biblivre)

Em **Gestão → Dados**:

1. Arraste o arquivo de backup. O sistema reconhece sozinho: **Biblivre (`.b5bz`)**, **MARC21 (`.mrc`/`.iso`)**, **MARCXML**, **CSV/TSV**, **Excel (`.xlsx`)**, **JSON** do próprio R.A.I.L.D.A e **ZIP**.
2. Confira o resumo (títulos, exemplares, usuários, empréstimos, reservas) e a prévia. Em planilhas, **relacione as colunas** do arquivo aos campos do sistema.
3. Marque **Apenas simular** para ver o que aconteceria **sem gravar nada**.
4. Desmarque e clique em **Iniciar importação**. Itens que já existem (mesmo tombo ou login) são ignorados — dá para importar o mesmo arquivo de novo sem duplicar.
5. Ao final, baixe o arquivo de **logins e senhas temporárias** dos usuários importados e entregue-os às pessoas.
6. Para recuperar capas: no painel **Capas dos livros**, escolha os métodos e rode a busca em lote. Cada livro é testado por **vários métodos** (por ISBN e também por título + autor) até aparecer uma imagem válida. Baixe a lista dos não encontrados e resolva com fotos.
7. **Importou por engano ou era só um teste?** Em **Importações realizadas**, use **Apagar tudo desta importação** (você digita `APAGAR` para confirmar). Registros cadastrados à mão são preservados.

**Exportar:** escolha as tabelas e o formato — **JSON** (backup completo, reimportável), **Excel**, **CSV (ZIP)**, **MARC21** ou **MARCXML**. Senhas só saem se você marcar a opção.

---

## 🚀 Colocando o seu próprio R.A.I.L.D.A no ar

Você só precisa de uma conta no **GitHub** e uma no **[Supabase](https://supabase.com)** (ambas gratuitas para começar).

1. **Faça um fork** deste repositório (botão *Fork*) ou baixe os arquivos.
2. **Crie um projeto no Supabase** e anote a *Project URL* e a chave *anon public* (Project Settings → API).
3. **Troque a conexão** — abra `scripts/script.js` e substitua `supabaseUrl` e `supabaseKey` pelos **seus** valores.
   > ⚠️ O projeto vem configurado com o banco de demonstração do autor. **Se você não trocar, estará lendo e gravando no banco de outra pessoa.**
4. **Crie as tabelas.** No Supabase, abra o *SQL Editor* e rode os scripts desta pasta, nesta ordem:
   `supabase_chat.sql` → `supabase_feed.sql` → `supabase_desbaste.sql` → `supabase_etiquetas.sql` → `supabase_updates.sql` → `supabase_importacao.sql` *(este último é opcional)*.
   > 🧩 **Importante:** as tabelas do núcleo — `acervo`, `usuarios_sistema`, `emprestimos`, `reservas`, `favoritos`, `resenhas` e `progresso_leitura` — vêm do projeto original e **ainda não têm um script único que as crie do zero**. Montar esse `supabase_base.sql` é uma ótima primeira contribuição (veja [Como contribuir](#-como-contribuir)).
5. **Publique** — no GitHub, vá em *Settings → Pages*, escolha a branch principal e salve. Em poucos minutos o sistema estará no ar.
6. **Crie o primeiro bibliotecário:** faça seu cadastro pelo sistema e, no Supabase (*Table Editor → `usuarios_sistema`*), mude o campo `cargo` do seu usuário para `bibliotecario`.
7. **Deixe com a sua cara:** *Gestão → Personalização* (nome, logo, cores, fonte).
8. **Ative os extras (opcionais):** chave do **Giphy** (Personalização) para buscar GIFs no feed e chave do **Google Livros** (Gestão → Dados → Capas) para aumentar o limite de consultas de capa.

---

## 🔐 Segurança — leia antes de usar dados reais

O R.A.I.L.D.A foi construído de forma incremental e **o seu modelo de acesso ainda é simples demais para dados sensíveis**. Transparência é parte do espírito aberto, então aqui vai a lista:

- O login é **próprio** (tabela `usuarios_sistema`), não usa o Supabase Auth, e **as senhas ficam em texto simples**.
- As políticas de acesso (RLS) das tabelas são **permissivas** para a chave pública (`anon`). Como o projeto é aberto, **qualquer pessoa que veja o código consegue usar essa chave**.
- Na prática: **não use com dados pessoais reais de outras pessoas** (nomes, telefones, e-mails) enquanto isso não for endurecido, ou mantenha o sistema em rede restrita.
- A tabela `configuracoes_sistema` é a exceção: só pode ser alterada por funções que validam cargo e senha no servidor (`supabase_updates.sql`). Esse é o modelo a seguir nas demais.

**Prioridades para quem quiser contribuir:** migrar para **Supabase Auth**, guardar senhas com **hash**, escrever políticas RLS por usuário e por cargo, e remover a coluna `senha` do alcance público.

---

## 🌍 Software livre e a regra de ouro

O R.A.I.L.D.A é software livre por convicção: conhecimento que ajuda pessoas a lerem deve circular.

**Você pode, livremente:**
- usar em qualquer biblioteca — escolar, comunitária, religiosa, empresarial, particular;
- estudar o código e aprender com ele;
- copiar, modificar e adaptar para a sua realidade;
- hospedar onde quiser, sem pagar nada ao autor.

**Em troca, uma única condição:**

> **Se você criar a sua versão (ou melhorar esta), disponibilize-a também.** Publique o código da sua versão, com a mesma liberdade, para que a próxima biblioteca possa usar o seu trabalho como você usou o nosso.

É assim que a corrente cresce: cada biblioteca que adapta o sistema deixa o próximo caminho mais curto.

**Licença recomendada: [GNU AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.html).** Ela foi pensada para exatamente esse caso: mesmo que alguém hospede o sistema na internet (em vez de distribuir arquivos), precisa oferecer o código da sua versão. Para oficializar no GitHub:

1. No repositório: *Add file → Create new file*.
2. Dê o nome **`LICENSE`**.
3. Clique em *Choose a license template* e escolha **GNU Affero General Public License v3.0**.
4. Confirme (*Commit*).

> Este texto descreve a intenção do projeto e não substitui aconselhamento jurídico. Se você tem dúvidas para o seu caso, consulte um profissional.

**Boas práticas ao publicar a sua versão**
- [ ] Mantenha o arquivo `LICENSE` e este aviso de origem.
- [ ] Dê o crédito ao projeto original e diga o que você mudou.
- [ ] **Troque as chaves do Supabase** e nunca publique senhas ou dados reais.
- [ ] Publique em um repositório público (um *fork* já resolve).
- [ ] Se puder, abra um *Pull Request* de volta com as melhorias que servem a todos.

---

## 💡 Crie o seu!

Você **não precisa ser programador profissional** para ter o seu sistema. Se você sabe abrir um arquivo de texto, trocar duas linhas e clicar em alguns botões, já consegue pôr uma versão no ar — e a cada ajuste você aprende um pouco mais. Todo grande sistema começou como a ideia de alguém que decidiu tentar.

**Ideias de adaptações para você começar:**
- 📖 **Biblioteca escolar** — turmas no lugar de clubes, ranking de páginas lidas por classe.
- ⛪ **Biblioteca comunitária ou de igreja** — acervo de uma paróquia, grupo de estudos.
- 🧸 **Ludoteca ou brinquedoteca** — troque "livro" por "brinquedo" e empreste jogos.
- 🛠️ **Biblioteca de ferramentas** — empréstimo de furadeiras e escadas entre vizinhos.
- 🏢 **Acervo técnico de empresa** — normas, manuais e livros do time.
- 🎵 **Discoteca, gibiteca, mapoteca** — qualquer coleção que precise de catálogo.
- 🌎 **Tradução** — adapte os textos para outro idioma e leve o sistema a outro país.

**Como começar em 10 minutos:** faça o *fork*, troque o nome em *Gestão → Personalização*, mude as cores e publique. A partir daí, cada melhoria é um passo seu.

Se o seu sistema ficar bom, **compartilhe**. Alguém, em algum lugar, está procurando exatamente o que você construiu.

---

## 🤝 Como contribuir

Toda ajuda é bem-vinda — código, documentação, testes, traduções, ideias e até avisos de erro.

1. Faça um *fork* e crie uma branch para a sua mudança.
2. Teste **no PC e no celular** (o projeto trata os dois layouts como obrigatórios).
3. Abra um *Pull Request* explicando o que mudou e por quê.

**Ideias em aberto**
- `supabase_base.sql` — script único que cria as tabelas do núcleo.
- Migração para **Supabase Auth**, senhas com hash e RLS por cargo (veja *Segurança*).
- Recuperação de senha por e-mail.
- Modo offline para uso no balcão sem internet.
- Notificações de vencimento de empréstimo.
- Leitor de código de barras pela câmera do celular.
- Testes automatizados e tradução para outros idiomas.

---

## 🗂️ Estrutura do projeto

```
index.html          Acervo (consulta, busca avançada, vitrine de capas)
minha-area.html     Feed, leituras, favoritos, reservas, chat, perfil, moderação
catalogacao.html    Catalogar, empréstimos, reservas, etiquetas, desbaste
usuarios.html       Gestão: usuários, relatórios, dados, personalização, mensagens
suporte.html        Fale conosco e perguntas frequentes
lixeira.html        Livros excluídos (restauração)
supabase_*.sql      Scripts do banco de dados
scripts/
  script.js         Conexão com o Supabase, login e permissões
  busca.js          Busca avançada, vitrine aleatória e grade de capas
  registros.js      Catalogação MARC21 e CIP
  hub.js            Empréstimos, reservas e desbaste
  etiquetas.js      Etiquetas A4 com código de barras e PDF
  leituras.js       Estante, páginas lidas e estatísticas
  minha-area.js     Feed social e moderação
  chat.js           Conversas e clubes
  gestao-hub.js     Relatórios, mensagens e suporte
  importacao.js     Importar/exportar a base e apagar importações
  io-formatos.js    Leitores e gravadores de Biblivre, MARC, CSV, XLSX e JSON
  capas.js          Recuperação de capas por vários métodos
  personalizacao.js Painel white-label (cores, logos, fonte)
  tema.js           Aplica o tema salvo em todas as páginas
  header.js/css     Cabeçalho compacto e menu do usuário
  mobile.css/js     Ajustes para celular
```

**Tecnologias:** HTML, CSS e JavaScript puros · [Supabase](https://supabase.com) (banco, tempo real e armazenamento) · [Bootstrap 5](https://getbootstrap.com) (grade, utilitários e menus) · [Font Awesome](https://fontawesome.com) (ícones) · [jsPDF](https://github.com/parallax/jsPDF) (etiquetas).

---

## 🙏 Créditos

Idealizado e desenvolvido por **malo**, com a colaboração de **Claude** (Anthropic) na construção do código.

O R.A.I.L.D.A só faz sentido se for usado, adaptado e compartilhado. **Boa leitura e bom código!** 📚

