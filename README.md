# Teste do coletor hospedado (Leroy, Magalu, Dexco)

O teste responde uma pergunta: de que jeito dá para ler o preço de uma página de produto das lojas protegidas, a partir da nuvem e sem pagar nada?

Ele faz uma requisição por loja e variante, com pausa de 20 a 40 s entre todas, no GitHub Actions. Grava status, preço (se achou), marcador de desafio, título da página, tamanho e a origem da requisição. Não grava o HTML das páginas.

**Este repositório é público.** As URLs digitadas, os títulos, os preços, as mensagens de erro e a origem (com o IP mascarado) ficam no log, no resumo e no artefato de cada run. Nunca cole uma chave nos campos do "Run workflow". Chaves vão só nos segredos.

## As variantes

| Variante | O que é | Conta |
| --- | --- | --- |
| `impit` | Cliente HTTP que imita o Chrome, com o IP do GitHub | Nenhuma |
| `patchright` | Chrome com janela, com o IP do GitHub | Nenhuma |
| `camoufox` | Firefox antidetecção com janela, com o IP do GitHub | Nenhuma |
| `brightdata-unlocker` | Desbloqueador da Bright Data | Bright Data |
| `brightdata-browser` | Navegador remoto da Bright Data | Bright Data |
| `zyte` | Zyte API com navegador | Zyte |
| `zenrows` | ZenRows com navegador e proxy residencial | ZenRows |

## 1. Contas que você cria

Condições lidas nas páginas dos fornecedores em 2026-11-25. Confira na hora do cadastro. Você não precisa de todas: a variante sem segredo sai como "pulada".

| Conta | Pede cartão? | Grátis |
| --- | --- | --- |
| [Bright Data](https://brightdata.com) | Não | 5.000 créditos por mês. Sem depósito, o serviço para quando eles acabam e não há cobrança. Não faça depósito. |
| [ZenRows](https://www.zenrows.com) | Não | 5.000 créditos por mês |
| [Zyte](https://www.zyte.com) | Talvez (as fontes se contradizem) | US$ 5 por um mês. Se pedir cartão e você não quiser, pule. |

Na Bright Data, crie duas zonas: uma **Web Unlocker API** e uma **Browser API**.

Consumo de um run completo, pela estimativa do estudo: 3 créditos no Unlocker, de 50 a 150 no Browser API, centavos do crédito da Zyte e 75 créditos na ZenRows.

## 2. Onde cadastrar cada segredo

No GitHub, abra este repositório e vá em **Settings > Secrets and variables > Actions > New repository secret**. Crie um segredo por linha, com o nome exatamente como está aqui.

| Nome do segredo | Valor | Variante que ele liga |
| --- | --- | --- |
| `BRIGHTDATA_API_KEY` | A API key da Bright Data | `brightdata-unlocker` (junto com `BRIGHTDATA_ZONE`) |
| `BRIGHTDATA_ZONE` | O nome da zona Web Unlocker | `brightdata-unlocker` (junto com `BRIGHTDATA_API_KEY`) |
| `BRIGHTDATA_BROWSER_AUTH` | Usuário e senha da zona Browser API, no formato `brd-customer-<id>-zone-<zona>:<senha>` | `brightdata-browser` |
| `ZENROWS_API_KEY` | A API key da ZenRows | `zenrows` |
| `ZYTE_API_KEY` | A API key da Zyte | `zyte` |

## 3. Como rodar

O workflow só roda quando alguém clica. O botão "Run workflow" aparece quando o arquivo `.github/workflows/medir.yml` está na branch `main`.

1. No seu navegador, abra uma página de **produto** de cada loja, de preferência o mesmo produto nas três. Copie as três URLs. Apague parâmetros de rastreamento (o que começa com `?utm_`, por exemplo). Páginas de busca são recusadas.
2. Vá em **Actions > medir-coletor-hospedado > Run workflow**.
3. Cole as três URLs em `leroy_url`, `magalu_url` e `dexco_url`. Deixe `variantes` como está para rodar todas.
4. Clique em **Run workflow**. Cada clique faz requisições reais às lojas: 21 com as sete variantes. A estimativa de duração é de 12 a 18 minutos.

## 4. Como ler o resultado

Abra o run. A página dele mostra a tabela **Resultado da medição**. No fim da mesma página, o artefato `saida-medicao` traz o `saida.json`, com os mesmos dados e o preço encontrado.

| Coluna | Como ler |
| --- | --- |
| Status | O código HTTP. `200` é página entregue. `pulada` é falta de segredo. `erro` é falha antes de haver resposta. |
| Achou preço | `sim` só com status 200 e um único preço nos dados estruturados da página. Com mais de um preço diferente, fica `não`. |
| Marcador de desafio | O sistema anti-bot reconhecido no texto da resposta: `akamai`, `datadome`, `cloudflare`, `perimeterx`, `incapsula` ou `magalu-403`. Uma página entregue também pode citar o sistema. Se "Achou preço" for `sim`, a página veio. |
| Título | O título da página recebida. Ajuda a distinguir o produto de uma tela de bloqueio. |
| Observação | O motivo de uma variante pulada, a mensagem de erro (só a primeira linha) ou o código de erro do fornecedor. |

Quando achar preço, compare o campo `preco` do `saida.json` com o que você vê no navegador.

O critério, escrito antes da medição:

| Resultado | Leitura | Consequência |
| --- | --- | --- |
| `patchright` ou `camoufox` com preço no Leroy e no Magalu | O navegador passa com IP de datacenter, no primeiro contato | Repetir com 10 produtos ao longo de uma semana antes de fixar essa via |
| Navegador bloqueado e desbloqueador com preço | O bloqueio é o IP de datacenter ou a máquina do navegador | Usar o desbloqueador |
| `brightdata-unlocker` com `400` e `ub_bad_endpoint_robots` | O `robots.txt` da loja proíbe a página para conta sem verificação de empresa (KYC) | Fazer o KYC na Bright Data ou usar ZenRows ou Zyte |
| `impit` com `200` e preço na Dexco | A Dexco aceita IP de datacenter | A Dexco não precisa de desbloqueador |
| Todos os fornecedores com 403 ou erro | A loja vence até o desbloqueador no primeiro contato | Tentar de novo com o campo `render` na chamada da Bright Data, o que exige mudar o script. Se continuar, a loja fica de fora da primeira versão |

Um run mede o primeiro contato. Ele não mede a taxa de sucesso ao longo do tempo.

O GitHub Actions serve para este teste. Os termos do GitHub não permitem usá-lo para a coleta de preços em produção.

## Testar sem tocar nas lojas

`teste-local/servidor.mjs` imita as três lojas e os três fornecedores em `127.0.0.1`. Precisa de Node 24. Em Linux sem tela, ponha `xvfb-run -a` antes do `node medir-nuvem.mjs`.

```
# Navegadores numa pasta própria, para não mexer nos de outros projetos.
export PLAYWRIGHT_BROWSERS_PATH="$PWD/node_modules/.navegadores" CAMOUFOX_INSTALL_DIR="$PWD/node_modules/.camoufox"
npm install
npx patchright install chromium
npx camoufox-js fetch
node teste-local/servidor.mjs &
TESTE_LOCAL=1 PAUSA_MS=500 ESPERA_PAGINA_MS=500 CHROME_CHANNEL=chromium \
  LEROY_URL=http://127.0.0.1:47811/leroy/p MAGALU_URL=http://127.0.0.1:47811/magalu/p DEXCO_URL=http://127.0.0.1:47811/dexco/p \
  VARIANTES=impit,patchright,camoufox,brightdata-unlocker,zyte,zenrows \
  BRIGHTDATA_API_KEY=x BRIGHTDATA_ZONE=z ZYTE_API_KEY=x ZENROWS_API_KEY=x \
  TESTE_BRIGHTDATA_URL=http://127.0.0.1:47811 TESTE_ZYTE_URL=http://127.0.0.1:47811 TESTE_ZENROWS_URL=http://127.0.0.1:47811 \
  node medir-nuvem.mjs teste-local/saida.json
node resumo.mjs teste-local/saida.json
```

A variante `brightdata-browser` também roda localmente se `TESTE_BRIGHTDATA_WSS` apontar para o endereço CDP de um Chromium local e `BRIGHTDATA_BROWSER_AUTH` tiver um valor qualquer.

Mesmo no teste local, o script consulta `ipinfo.io` para registrar a origem. O `saida.json` fica com a cidade e o provedor da sua rede: não publique esse arquivo.
