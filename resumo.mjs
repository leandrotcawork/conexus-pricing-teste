// Escreve a tabela do resultado no resumo do run (GITHUB_STEP_SUMMARY) ou, fora do Actions, no terminal.
// Uso: node resumo.mjs saida.json
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const arquivo = process.argv[2];
if (!arquivo) throw new Error('informe o arquivo de saída: node resumo.mjs saida.json');

// O título vem da página da loja: não pode virar HTML, link nem coluna nova no resumo.
const celula = (valor) => String(valor ?? '—')
    .replace(/\s+/g, ' ')
    .replace(/[\\`*_~|[\]]/g, '\\$&')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

function colunas(r) {
    if (r.pulada) return [r.variante, null, 'pulada', null, null, null, r.pulada];
    if (r.erro) return [r.variante, r.alvo, 'erro', 'não', null, null, r.erro];
    const preco = r.veio_preco ? 'sim' : r.precos_distintos > 1 ? `não (${r.precos_distintos} preços distintos)` : 'não';
    return [r.variante, r.alvo, r.status, preco, r.desafio, r.titulo_final || r.titulo, r.erro_fornecedor];
}

function resumo() {
    if (!existsSync(arquivo)) return 'A medição parou antes de gravar o resultado. Veja o log do passo "Medir".';
    const { origem_rotulo: rotulo, resultados } = JSON.parse(readFileSync(arquivo, 'utf8'));
    const cabecalho = ['Variante', 'Loja', 'Status', 'Achou preço', 'Marcador de desafio', 'Título', 'Observação'];
    return [
        `Origem: ${celula(rotulo)}`,
        '',
        `| ${cabecalho.join(' | ')} |`,
        `|${' --- |'.repeat(cabecalho.length)}`,
        ...resultados.map((r) => `| ${colunas(r).map(celula).join(' | ')} |`),
    ].join('\n');
}

const texto = `## Resultado da medição\n\n${resumo()}\n`;
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, texto);
else process.stdout.write(texto);
