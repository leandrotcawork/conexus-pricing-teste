// Servidor local que imita as três lojas e os três fornecedores, para testar o medir-nuvem.mjs sem tocar em nada real.
import { createServer } from 'node:http';

const produto = (preco) => `<!doctype html><html lang="pt-BR"><head><title>Torneira Deca - Loja</title>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Torneira","gtin13":"7894200795353",
"offers":{"@type":"Offer","price":"${preco}","priceCurrency":"BRL","availability":"https://schema.org/InStock"}}</script></head><body>ok</body></html>`;
const datadome = '<html><head><title>leroymerlin.com.br</title></head><body><script>var dd={"cid":"x"}</script><iframe src="https://geo.captcha-delivery.com/captcha/"></iframe></body></html>';
const magalu = '<html><head><title>Magazine Luiza | Não é possível acessar a página</title></head><body>Não é possível acessar a página</body></html>';
const akamai = '<HTML><HEAD><TITLE>Access Denied</TITLE></HEAD><BODY>Access Denied ... Reference #18.1a2b3c</BODY></HTML>';

const loja = (caminho) => {
    if (caminho.includes('leroy')) return [403, datadome];
    if (caminho.includes('magalu')) return [403, magalu];
    if (caminho.includes('dexco-bloqueada')) return [403, akamai];
    if (caminho.includes('dexco')) return [200, produto('249.90')];
    return [404, 'nada'];
};

const corpoDe = (req) => new Promise((ok) => { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => ok(b)); });

createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'POST' && url.pathname === '/request') { // Bright Data Direct API
        const { url: alvo, country, zone } = JSON.parse(await corpoDe(req));
        if (!req.headers.authorization?.startsWith('Bearer ') || !zone || country !== 'br') { res.writeHead(401); return res.end('auth'); }
        if (alvo.includes('leroy')) { res.writeHead(400, { 'x-brd-err-code': 'ub_bad_endpoint_robots' }); return res.end('robots'); }
        res.writeHead(200, { 'content-type': 'text/html' }); return res.end(produto('199.00'));
    }
    if (req.method === 'POST' && url.pathname === '/v1/extract') { // Zyte API
        const { url: alvo, browserHtml, geolocation } = JSON.parse(await corpoDe(req));
        if (!req.headers.authorization?.startsWith('Basic ') || !browserHtml || geolocation !== 'BR') { res.writeHead(401); return res.end('{}'); }
        if (alvo.includes('magalu')) { res.writeHead(520, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ type: '/download/temporary-error', title: 'Temporary Downloading Error' })); }
        res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ url: alvo, statusCode: 200, browserHtml: produto('205.50') }));
    }
    if (req.method === 'GET' && url.pathname === '/v1/') { // ZenRows Fetch
        const p = url.searchParams;
        if (!p.get('apikey') || p.get('premium_proxy') !== 'true' || p.get('proxy_country') !== 'br' || p.get('js_render') !== 'true') { res.writeHead(400); return res.end('{}'); }
        const [status, corpo] = loja(new URL(p.get('url')).pathname);
        res.writeHead(status, { 'content-type': 'text/html', 'x-request-cost': status === 200 ? '25' : '0' }); return res.end(corpo);
    }
    const [status, corpo] = loja(url.pathname);
    res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' });
    res.end(corpo);
}).listen(Number(process.env.PORTA ?? 47811), '127.0.0.1', () => console.log('servidor local pronto'));
