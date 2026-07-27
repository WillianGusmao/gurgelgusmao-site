# Gurgel Gusmão — site institucional com feed de notícias

Este pacote contém o site pronto para publicar, com uma seção de
notícias jurídicas que se atualiza sozinha, sem servidor próprio e sem
conta paga.

## O que tem aqui

```
index.html                                 → o site
data/noticias.json                         → notícias exibidas (gerado automaticamente)
fetch_noticias.py                          → script que busca as notícias
.github/workflows/atualizar-noticias.yml   → agenda a execução do script
```

## Como funciona (sem depender de servidor)

O `index.html` só lê o arquivo `data/noticias.json`, que fica no mesmo
site — por isso não há bloqueio de CORS. Periodicamente, o GitHub
Actions roda o `fetch_noticias.py`, que busca as fontes RSS
configuradas e soma os itens novos aos que já estão no arquivo (sem
apagar o que você já curou).

**Nada vai para o ar sozinho.** Em vez de publicar direto, o workflow
abre um **Pull Request** chamado "Notícias novas para revisão" com as
notícias candidatas. Você:

1. Recebe uma notificação do GitHub (e-mail, se as notificações estiverem ativas).
2. Abre o PR e revisa os itens em `data/noticias.json`, na aba "Files changed".
3. Apaga o que não quiser publicar, edita o `resumo` de qualquer item se quiser reescrever, corrige o que precisar — direto no editor do GitHub, sem precisar baixar nada.
4. Clica em **Merge pull request** quando estiver satisfeito. Só nesse momento o site é atualizado (o GitHub Pages republica sozinho a partir do merge).
5. Se não quiser publicar nada daquela leva, feche o PR sem mesclar. A próxima execução agendada abre um PR novo, sem perder o que já está publicado.

Como o script soma (não sobrescreve), um item que você já aprovou num
PR anterior permanece no site mesmo depois de várias execuções
seguintes — só é removido quando sai da janela dos itens mais recentes
(`MAX_ITENS_TOTAL`, hoje 15) ou se você mesmo apagar. Uma ressalva: se
você rejeitar um item fechando o PR sem mesclar, e ele ainda estiver
entre os mais recentes do feed original na próxima execução, ele pode
reaparecer como candidato de novo — o script não guarda uma lista de
"rejeitados", só de "já publicados". Na prática isso raramente
incomoda, porque itens saem da janela do RSS de origem em um ou dois
dias.

## Passo a passo para publicar (GitHub Pages, gratuito)

1. **Crie uma conta gratuita em [github.com](https://github.com)**, se ainda não tiver.
2. **Crie um repositório novo** (pode ser público; se quiser privado, o GitHub Pages gratuito também funciona em repositório privado).
3. **Envie estes arquivos para o repositório**, mantendo a mesma estrutura de pastas (incluindo a pasta oculta `.github`). O jeito mais simples é usar "Add file → Upload files" na interface do GitHub e arrastar a pasta inteira, ou usar `git` pela linha de comando:
   ```bash
   git init
   git add .
   git commit -m "Site inicial"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
   git push -u origin main
   ```
4. **Ative o GitHub Pages**: no repositório, vá em *Settings → Pages → Build and deployment → Source* e selecione **"Deploy from a branch"**, branch `main`, pasta `/ (root)`. Salve.
5. **Confirme que as Actions estão habilitadas**: em *Settings → Actions → General*, deixe marcado "Allow all actions".
6. **Rode o workflow manualmente uma vez**, para testar: aba *Actions* → "Atualizar notícias" → *Run workflow*. Depois de alguns segundos, confira se o arquivo `data/noticias.json` foi atualizado no repositório.
7. Em alguns minutos, seu site estará em `https://SEU-USUARIO.github.io/SEU-REPOSITORIO/`.

## Usando seu próprio domínio (gurgelgusmao.adv.br) — mantendo o e-mail no Netlify

Sim, dá para usar o GitHub Pages sem mexer no seu e-mail. Hospedagem de
site (GitHub Pages) e gerenciamento de DNS (Netlify DNS, no seu caso)
são duas coisas independentes — o e-mail funciona através de registros
`MX`, e o site funciona através de registros `A`/`CNAME`. São tipos de
registro diferentes, coexistindo na mesma zona DNS sem conflito. Você
não precisa mudar de nameserver nem tocar nos registros `MX` que já
existem para o Zoho Mail.

O que fazer, no painel de DNS do Netlify (onde seu domínio já está
gerenciado):

1. Para o domínio raiz (`gurgelgusmao.adv.br`), crie **quatro registros A** apontando para os IPs do GitHub Pages:
   ```
   185.199.108.153
   185.199.109.153
   185.199.110.153
   185.199.111.153
   ```
2. Para o subdomínio `www`, crie um **CNAME** apontando para `SEU-USUARIO.github.io`.
3. No repositório do GitHub, em *Settings → Pages → Custom domain*, informe `gurgelgusmao.adv.br` e salve (isso cria um arquivo `CNAME` no repositório automaticamente).
4. Espere a propagação do DNS (pode levar de minutos a algumas horas) e depois marque "Enforce HTTPS" na mesma tela — o certificado é emitido automaticamente pelo GitHub, sem custo.
5. Confirme que os registros `MX` do Zoho continuam intactos no painel do Netlify — você só está *acrescentando* registros A/CNAME, não substituindo nada.

## Migrando do Netlify (saindo do tier gratuito no limite)

Importante: **"site do Netlify" e "DNS do Netlify" são coisas separadas**.
O limite do plano gratuito (banda, minutos de build) é consumido pelo
site publicado lá — não pela zona de DNS, que pode continuar no
Netlify sem problema (é onde vive o e-mail). Migrar a hospedagem para
o GitHub Pages não libera o tier sozinho; é preciso também desconectar
o site antigo do Netlify.

Ordem recomendada, para não ficar sem site no ar durante a troca:

1. Suba os arquivos deste pacote para um repositório novo no GitHub.
2. Ative o GitHub Pages (*Settings → Pages*) e confirme que o site funciona no endereço padrão `seu-usuario.github.io/seu-repositorio`.
3. Rode o workflow manualmente uma vez (*Actions → Run workflow*) e confirme que o PR de curadoria abre normalmente.
4. Só então configure o domínio próprio: adicione os registros A/CNAME no painel de DNS do Netlify (seção **DNS**, não **Sites**) — ver seção anterior deste README.
5. Espere o domínio passar a servir o site do GitHub Pages e ative "Enforce HTTPS".
6. Por último, vá em **Sites** (não em DNS) no painel do Netlify e desative o deploy automático ou apague o site antigo de lá. É esse passo — não o de DNS — que efetivamente libera o seu uso do tier gratuito. A zona de DNS e o e-mail continuam intactos.

## Ajustando a frequência de atualização

No arquivo `.github/workflows/atualizar-noticias.yml`, a linha
`cron: '0 */3 * * *'` roda a busca a cada 3 horas (horário UTC). Para
mudar, ajuste essa expressão cron — por exemplo, `0 6,12,18 * * *`
roda três vezes ao dia, aproximadamente 3h, 9h e 15h no horário de
Brasília.

## Adicionando ou trocando fontes de notícias

Edite a lista `FONTES` no início do `fetch_noticias.py`. Cada fonte
precisa de uma URL de feed RSS válida (não é qualquer link do site, é
especificamente o endereço do feed). Fontes confirmadas manualmente em
27/07/2026:

- **ConJur** — `https://www.conjur.com.br/rss.xml` (100% conteúdo jurídico)
- **JOTA** — `https://www.jota.info/feed` (traz também cobertura de política geral, além de Direito — avalie se quer manter)
- **Migalhas** — não foi encontrado um feed RSS público no site atual. Se você descobrir o endereço certo (ou tiver acesso via parceria/assinatura), é só adicionar no mesmo formato.

## Uso do conteúdo

A seção exibe apenas título, data, um resumo curto e o link para a
notícia original — nunca o texto completo do artigo. Isso é o uso
padrão para o qual o RSS foi criado (sindicação de manchetes) e evita
qualquer problema de reprodução integral de conteúdo de terceiros.
Para transformar essas notícias em conteúdo próprio (posts, e-mails,
newsletter), use-as como fonte de pauta e escreva sua própria análise
— não republique o texto da fonte.
