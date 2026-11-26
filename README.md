# Teste do coletor hospedado (Leroy, Magalu, Dexco)

Uma requisição por loja e variante, com pausa de 20 a 40 s entre todas, a partir da nuvem.
Grava só status, se veio preço (e qual), o desafio e o título da página. Não grava o HTML.

## Rodar no GitHub Actions

1. Criar um repositório **privado** e subir esta pasta (com `.github/workflows/medir.yml`).
2. Em Settings > Secrets and variables > Actions, criar os segredos das contas que você abriu
   (os que faltarem fazem a variante sair como "pulada"):
   - `BRIGHTDATA_API_KEY` e `BRIGHTDATA_ZONE` (zona Web Unlocker);
   - `BRIGHTDATA_BROWSER_AUTH` no formato `brd-customer-<id>-zone-<zona>:<senha>` (zona Browser API);
   - `ZYTE_API_KEY`;
   - `ZENROWS_API_KEY`.
3. Actions > medir-coletor-hospedado > Run workflow, com as três páginas de **produto**.
4. Baixar o artefato `saida-medicao` (arquivo `saida.json`) e entregar.

## Rodar numa máquina em São Paulo (Fly.io, opcional)

```
fly apps create teste-coletor-<sufixo>
fly machine run . --dockerfile Dockerfile --app teste-coletor-<sufixo> --region gru --rm --vm-memory 2048 \
  -e VARIANTES=impit,patchright,camoufox -e ORIGEM_ROTULO=fly-gru \
  -e LEROY_URL='https://...' -e MAGALU_URL='https://...' -e DEXCO_URL='https://...'
fly logs --app teste-coletor-<sufixo>
```

## Testar sem tocar em nada real

```
node teste-local/servidor.mjs &
TESTE_LOCAL=1 PAUSA_MS=500 ESPERA_PAGINA_MS=500 CHROME_CHANNEL=chromium \
  LEROY_URL=http://127.0.0.1:47811/leroy/p MAGALU_URL=http://127.0.0.1:47811/magalu/p DEXCO_URL=http://127.0.0.1:47811/dexco/p \
  VARIANTES=impit,patchright,camoufox,brightdata-unlocker,zyte,zenrows \
  BRIGHTDATA_API_KEY=x BRIGHTDATA_ZONE=z ZYTE_API_KEY=x ZENROWS_API_KEY=x \
  TESTE_BRIGHTDATA_URL=http://127.0.0.1:47811 TESTE_ZYTE_URL=http://127.0.0.1:47811 TESTE_ZENROWS_URL=http://127.0.0.1:47811 \
  node medir-nuvem.mjs teste-local/saida.json
```
