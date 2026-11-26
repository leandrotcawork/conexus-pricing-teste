// Teste do coletor hospedado: 1 requisição por alvo e variante, com pausa longa, a partir da nuvem.
// Grava só status, se veio preço (e qual), o tipo e o título do desafio, o tamanho e a origem. Não grava o HTML.
// Uso: LEROY_URL=... MAGALU_URL=... DEXCO_URL=... node medir-nuvem.mjs saida.json
// Variantes: VARIANTES=impit,patchright,camoufox,brightdata-unlocker,brightdata-browser,zyte,zenrows (padrão: todas).
// Uma variante paga roda só se a chave dela estiver no ambiente; sem chave, a linha diz "pulada".
import { writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const saida = process.argv[2];
if (!saida) throw new Error('informe o arquivo de saída: node medir-nuvem.mjs saida.json');

const ALVOS = [
    { id: 'leroy', url: process.env.LEROY_URL },
    { id: 'magalu', url: process.env.MAGALU_URL },
    { id: 'dexco', url: process.env.DEXCO_URL },
].filter((a) => a.url);
if (ALVOS.length === 0) throw new Error('informe ao menos uma página de produto: LEROY_URL, MAGALU_URL ou DEXCO_URL');
for (const a of ALVOS) {
    const local = process.env.TESTE_LOCAL === '1' && /^http:\/\/127\.0\.0\.1:/.test(a.url);
    if ((!local && !/^https:\/\//.test(a.url)) || /\/(busca|search)\b/.test(a.url)) throw new Error(`${a.id}: use uma página de PRODUTO https, não de busca: ${a.url}`);
}

const TODAS = ['impit', 'patchright', 'camoufox', 'brightdata-unlocker', 'brightdata-browser', 'zyte', 'zenrows'];
const VARIANTES = (process.env.VARIANTES || TODAS.join(',')).split(',').map((v) => v.trim()).filter(Boolean);
for (const v of VARIANTES) if (!TODAS.includes(v)) throw new Error(`variante desconhecida: ${v}`);

const PAUSA_MS = () => (process.env.PAUSA_MS ? Number(process.env.PAUSA_MS) : 20_000 + Math.floor(Math.random() * 20_000));
const ESPERA_PAGINA_MS = Number(process.env.ESPERA_PAGINA_MS ?? 8_000);
const ORIGEM = process.env.ORIGEM_ROTULO ?? 'desconhecida';
// Só para o teste local contra um servidor que imita os fornecedores; em produção ficam os endereços oficiais.
const BASE = {
    brightdata: process.env.TESTE_BRIGHTDATA_URL ?? 'https://api.brightdata.com',
    zyte: process.env.TESTE_ZYTE_URL ?? 'https://api.zyte.com',
    zenrows: process.env.TESTE_ZENROWS_URL ?? 'https://api.zenrows.com',
};

// Marcadores de desafio (os mesmos do estudo 3, mais o 403 do Magalu e o desafio gerenciado da Cloudflare).
const MARCAS_DESAFIO = [
    ['akamai', /Access Denied[\s\S]*Reference #|errors\.edgesuite\.net/i],
    ['datadome', /captcha-delivery\.com|var dd=|geo\.captcha-delivery|datadome/i],
    ['cloudflare', /cf-chl|challenges\.cloudflare\.com|Just a moment|Attention Required! \| Cloudflare/i],
    ['perimeterx', /px-captcha|_pxAppId|Press & Hold/i],
    ['incapsula', /_Incapsula_Resource|Incapsula incident/i],
    ['magalu-403', /Não é possível acessar a página/i],
];
const desafioDe = (texto) => MARCAS_DESAFIO.find(([, re]) => re.test(texto))?.[0] ?? null;
const tituloDe = (html) => (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/\s+/g, ' ').trim().slice(0, 120) || null;

/** Preço só de campo nomeado: JSON-LD offers.price ou meta de preço. Nunca seletor visual. */
export function precoDe(corpo) {
    const precos = new Set();
    for (const bloco of corpo.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
        for (const m of bloco[1].matchAll(/"(?:price|lowPrice)"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)"?/g)) precos.add(Number(m[1]));
    }
    for (const m of corpo.matchAll(/(?:itemprop="price"|property="product:price:amount")[^>]*content="([0-9]+(?:\.[0-9]+)?)"/gi)) precos.add(Number(m[1]));
    const validos = [...precos].filter((p) => p > 0);
    return { preco: validos.length === 1 ? validos[0] : null, precos_distintos: validos.length };
}

const resultados = [];
function registra(variante, alvo, status, corpo, extra = {}) {
    const { preco, precos_distintos } = status === 200 ? precoDe(corpo) : { preco: null, precos_distintos: 0 };
    const desafio = desafioDe(corpo);
    const linha = {
        variante, alvo: alvo.id, url: alvo.url, status,
        veio_preco: preco !== null, preco, precos_distintos,
        desafio, titulo: tituloDe(corpo), bytes: corpo.length,
        em: new Date().toISOString(), ...extra,
    };
    resultados.push(linha);
    console.log(variante, alvo.id, status, preco !== null ? `preço ${preco}` : 'sem preço', desafio ?? '', extra.erro_fornecedor ?? '');
}
const registraErro = (variante, alvo, erro) => {
    resultados.push({ variante, alvo: alvo.id, url: alvo.url, erro: String(erro).slice(0, 300), em: new Date().toISOString() });
    console.log(variante, alvo.id, 'ERRO', String(erro).slice(0, 160));
};
const pulada = (variante, motivo) => {
    resultados.push({ variante, pulada: motivo });
    console.log(variante, 'pulada:', motivo);
};

// ---------- variantes locais (navegador ou cliente nosso, IP da máquina que roda) ----------

async function varianteImpit(alvos) {
    const { HttpCrawler, Configuration, log } = await import('crawlee');
    const { ImpitHttpClient, Browser } = await import('@crawlee/impit-client');
    log.setLevel(log.LEVELS.WARNING);
    for (const [i, alvo] of alvos.entries()) {
        if (i > 0) await sleep(PAUSA_MS());
        const crawler = new HttpCrawler({
            httpClient: new ImpitHttpClient({ browser: Browser.Chrome }),
            maxConcurrency: 1, maxRequestRetries: 0, useSessionPool: false,
            ignoreHttpErrorStatusCodes: [400, 401, 403, 404, 405, 406, 429, 500, 502, 503, 504],
            async requestHandler({ request, response, body }) { registra('impit', request.userData.alvo, response.statusCode, String(body)); },
            failedRequestHandler({ request }, erro) { registraErro('impit', request.userData.alvo, erro); },
        }, new Configuration({ persistStorage: false }));
        await crawler.run([{ url: alvo.url, uniqueKey: `impit-${alvo.id}`, userData: { alvo } }]);
    }
}

async function varianteNavegador(nome, alvos) {
    const { PlaywrightCrawler, Configuration, log } = await import('crawlee');
    log.setLevel(log.LEVELS.WARNING);
    let launchContext;
    if (nome === 'patchright') {
        // Estudo 3, seção 8.2: Chrome instalado + Patchright, sem impressão injetada, pt-BR, com janela (xvfb na nuvem).
        const { chromium } = await import('patchright');
        launchContext = {
            launcher: chromium,
            launchOptions: { channel: process.env.CHROME_CHANNEL ?? 'chrome', headless: false, args: ['--lang=pt-BR'] },
            // CHROME_CHANNEL=chromium usa o Chromium do próprio Patchright quando não há Chrome instalado.
            useIncognitoPages: false,
        };
    } else {
        // Template oficial camoufox-ts do Crawlee (packages/templates/templates/camoufox-ts/src/main.ts).
        const { firefox } = await import('playwright');
        const { launchOptions } = await import('camoufox-js');
        launchContext = {
            launcher: firefox,
            launchOptions: await launchOptions({ headless: false, locale: 'pt-BR', geoip: false, os: 'windows' }),
        };
    }
    for (const [i, alvo] of alvos.entries()) {
        if (i > 0) await sleep(PAUSA_MS());
        const crawler = new PlaywrightCrawler({
            launchContext,
            browserPoolOptions: { useFingerprints: false },
            useSessionPool: false,
            maxConcurrency: 1, maxRequestRetries: 0,
            navigationTimeoutSecs: 60, requestHandlerTimeoutSecs: 120,
            preNavigationHooks: [async ({ page }) => {
                await page.context().setExtraHTTPHeaders({ 'Accept-Language': 'pt-BR,pt;q=0.9' });
            }],
            async requestHandler({ request, page, response }) {
                await page.waitForTimeout(ESPERA_PAGINA_MS);
                registra(nome, request.userData.alvo, response?.status() ?? 0, await page.content(), {
                    titulo_final: (await page.title()).slice(0, 120), url_final: page.url(),
                });
            },
            failedRequestHandler({ request }, erro) { registraErro(nome, request.userData.alvo, erro); },
        }, new Configuration({ persistStorage: false }));
        await crawler.run([{ url: alvo.url, uniqueKey: `${nome}-${alvo.id}`, userData: { alvo } }]);
    }
}

// ---------- variantes de fornecedor (o IP e o navegador são do fornecedor; cobram por sucesso ou por MB) ----------

async function chamar(url, init) {
    const resposta = await fetch(url, { ...init, signal: AbortSignal.timeout(180_000) });
    return { resposta, texto: await resposta.text() };
}

// Bright Data Web Unlocker, Direct API: docs.brightdata.com/api-reference/rest-api/unlocker/unlock-website.md
async function brightdataUnlocker(alvo) {
    const { resposta, texto } = await chamar(`${BASE.brightdata}/request`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.BRIGHTDATA_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone: process.env.BRIGHTDATA_ZONE, url: alvo.url, format: 'raw', country: 'br' }),
    });
    registra('brightdata-unlocker', alvo, resposta.status, texto, {
        erro_fornecedor: resposta.headers.get('x-brd-err-code') ?? resposta.headers.get('x-brd-error') ?? null,
    });
}

// Bright Data Browser API: wss://<auth>@brd.superproxy.io:9222, país pelo sufixo -country-br no usuário.
async function brightdataBrowser(alvo) {
    const { chromium } = await import('playwright');
    const [usuario, senha] = process.env.BRIGHTDATA_BROWSER_AUTH.split(':');
    const auth = `${usuario.includes('-country-') ? usuario : `${usuario}-country-br`}:${senha}`;
    const navegador = await chromium.connectOverCDP(process.env.TESTE_BRIGHTDATA_WSS ?? `wss://${auth}@brd.superproxy.io:9222`);
    try {
        const pagina = await navegador.newPage();
        const resposta = await pagina.goto(alvo.url, { timeout: 120_000, waitUntil: 'domcontentloaded' });
        await pagina.waitForTimeout(ESPERA_PAGINA_MS);
        registra('brightdata-browser', alvo, resposta?.status() ?? 0, await pagina.content(), { titulo_final: (await pagina.title()).slice(0, 120) });
    } finally {
        await navegador.close();
    }
}

// Zyte API: POST /v1/extract com browserHtml e geolocation BR (docs.zyte.com/zyte-api/usage/reference.html).
async function zyte(alvo) {
    const { resposta, texto } = await chamar(`${BASE.zyte}/v1/extract`, {
        method: 'POST',
        headers: { Authorization: `Basic ${Buffer.from(`${process.env.ZYTE_API_KEY}:`).toString('base64')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: alvo.url, browserHtml: true, geolocation: 'BR' }),
    });
    let corpo = texto;
    let status = resposta.status;
    let erro = null;
    try {
        const json = JSON.parse(texto);
        if (typeof json.browserHtml === 'string') { corpo = json.browserHtml; status = json.statusCode ?? 200; }
        else erro = `${json.type ?? ''} ${json.title ?? ''}`.trim() || null;
    } catch { /* corpo não é JSON: fica o texto */ }
    registra('zyte', alvo, status, corpo, { status_fornecedor: resposta.status, erro_fornecedor: erro });
}

// ZenRows Fetch: GET https://api.zenrows.com/v1/ com js_render, premium_proxy e proxy_country=br (25 créditos por sucesso).
async function zenrows(alvo) {
    const params = new URLSearchParams({
        url: alvo.url, apikey: process.env.ZENROWS_API_KEY,
        js_render: 'true', premium_proxy: 'true', proxy_country: 'br', wait: String(ESPERA_PAGINA_MS),
        original_status: 'true',
    });
    const { resposta, texto } = await chamar(`${BASE.zenrows}/v1/?${params}`, { method: 'GET' });
    let erro = null;
    if (texto.trimStart().startsWith('{')) {
        try { const j = JSON.parse(texto); erro = j.code ? `${j.code} ${j.title ?? ''}`.trim() : null; } catch { /* HTML da loja */ }
    }
    registra('zenrows', alvo, resposta.status, texto, { erro_fornecedor: erro, custo_creditos: resposta.headers.get('x-request-cost') });
}

const FORNECEDORES = {
    'brightdata-unlocker': { chaves: ['BRIGHTDATA_API_KEY', 'BRIGHTDATA_ZONE'], fn: brightdataUnlocker },
    'brightdata-browser': { chaves: ['BRIGHTDATA_BROWSER_AUTH'], fn: brightdataBrowser },
    zyte: { chaves: ['ZYTE_API_KEY'], fn: zyte },
    zenrows: { chaves: ['ZENROWS_API_KEY'], fn: zenrows },
};

async function origem() {
    try {
        const { texto } = await chamar('https://ipinfo.io/json', { method: 'GET' });
        const { ip, city, region, country, org } = JSON.parse(texto);
        return { ip_mascarado: ip?.replace(/\.\d+$/, '.x'), city, region, country, org };
    } catch (erro) {
        return { erro: String(erro).slice(0, 120) };
    }
}

const inicio = new Date().toISOString();
const deOnde = await origem();
console.log('origem:', ORIGEM, JSON.stringify(deOnde));

for (const [i, variante] of VARIANTES.entries()) {
    if (i > 0) await sleep(PAUSA_MS());
    try {
        if (variante === 'impit') await varianteImpit(ALVOS);
        else if (variante === 'patchright' || variante === 'camoufox') await varianteNavegador(variante, ALVOS);
        else {
            const { chaves, fn } = FORNECEDORES[variante];
            const faltando = chaves.filter((c) => !process.env[c]);
            if (faltando.length) { pulada(variante, `sem ${faltando.join(', ')}`); continue; }
            for (const [j, alvo] of ALVOS.entries()) {
                if (j > 0) await sleep(PAUSA_MS());
                try { await fn(alvo); } catch (erro) { registraErro(variante, alvo, erro); }
            }
        }
    } catch (erro) {
        registraErro(variante, { id: '*', url: '*' }, erro);
    }
}

writeFileSync(saida, JSON.stringify({ origem_rotulo: ORIGEM, origem: deOnde, inicio, fim: new Date().toISOString(), resultados }, null, 2));
console.log('saída gravada em', saida);
