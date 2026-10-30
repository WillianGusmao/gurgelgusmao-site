// Gera LP/index.html: a lista das landing pages publicadas, ABERTA (sem senha).
// Desde 29/10/2026 a lista não é mais criptografada; a página tem noindex.
//
// Uso (a rotina .github/workflows/lista-lp.yml roda isto a cada push):
//   node .github/scripts/gerar-lista-lp.mjs
//
// LP = pasta na raiz com index.html, exceto as da lista IGNORAR.
// Datas vêm do git: criação = primeiro commit da pasta; modificação = último.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const RAIZ = process.cwd();
const IGNORAR = new Set(['LP', 'guias', 'data', '.github', '.git', 'node_modules']);

const git = (...args) => execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8' }).trim();
const meta = (html, re) => (html.match(re)?.[1] ?? '').replace(/&amp;/g, '&').trim();

const lps = readdirSync(RAIZ)
  .filter((d) => !IGNORAR.has(d) && !d.startsWith('.') && statSync(join(RAIZ, d)).isDirectory())
  .filter((d) => existsSync(join(RAIZ, d, 'index.html')))
  .map((d) => {
    const html = readFileSync(join(RAIZ, d, 'index.html'), 'utf8');
    const datas = git('log', '--format=%cI', '--', d).split('\n').filter(Boolean);
    return {
      caminho: `/${d}/`,
      titulo: meta(html, /<title>([^<]*)<\/title>/i) || d,
      descricao: meta(html, /<meta\s+name="description"\s+content="([^"]*)"/i),
      criada: datas.at(-1) ?? null,
      modificada: datas[0] ?? null,
      alteracoes: datas.length,
      indexada: !/<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html),
    };
  })
  .sort((a, b) => (b.criada ?? '').localeCompare(a.criada ?? ''));

// Só regrava se a lista mudou (senão cada push geraria um commit novo por causa de geradaEm).
const versao = createHash('sha256').update(JSON.stringify(lps)).digest('hex');
const destino = join(RAIZ, 'LP', 'index.html');
if (existsSync(destino) && readFileSync(destino, 'utf8').includes(`content="${versao}"`) && !process.argv.includes('--forcar')) {
  console.log('Lista sem mudança; LP/index.html mantido.');
  process.exit(0);
}

// "<" escapado para o JSON não fechar a tag <script> por acidente
const pacote = JSON.stringify({ geradaEm: new Date().toISOString(), lps }).replace(/</g, '\u003c');

const modelo = readFileSync(join(RAIZ, '.github', 'scripts', 'lp-modelo.html'), 'utf8');
if (!modelo.includes('__PACOTE__')) throw new Error('lp-modelo.html sem o marcador __PACOTE__');
mkdirSync(join(RAIZ, 'LP'), { recursive: true });
writeFileSync(destino, modelo.replace('__VERSAO__', versao).replace('__PACOTE__', () => pacote));
console.log(`LP/index.html gerado com ${lps.length} LP(s).`);
