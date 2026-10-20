// Gera LP/index.html: a lista das landing pages publicadas, CRIPTOGRAFADA.
//
// O repositório é público e o GitHub Pages não tem servidor, então não existe login
// de verdade: a lista vai cifrada (AES-GCM 256, chave derivada por PBKDF2-SHA256 com
// 600.000 iterações) a partir de usuário + senha. Sem os dois, ninguém lê a lista.
// A segurança depende da força da senha.
//
// Uso (a rotina .github/workflows/lista-lp.yml roda isto a cada push):
//   LP_USUARIO=... LP_SENHA=... node .github/scripts/gerar-lista-lp.mjs
//
// LP = pasta na raiz com index.html, exceto as da lista IGNORAR.
// Datas vêm do git: criação = primeiro commit da pasta; modificação = último.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHmac, webcrypto as crypto } from 'node:crypto';
import { join } from 'node:path';

const RAIZ = process.cwd();
const IGNORAR = new Set(['LP', 'guias', 'data', '.github', '.git', 'node_modules']);
const ITERACOES = 600000;

// usuário sem diferença de maiúsculas/minúsculas nem espaços nas pontas (a página faz o mesmo)
const usuario = (process.env.LP_USUARIO ?? '').trim().toLowerCase();
const senha = process.env.LP_SENHA ?? '';
if (!usuario || !senha) {
  console.error('Defina LP_USUARIO e LP_SENHA.');
  process.exit(1);
}

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

// Só regrava se a lista mudou (senão cada push geraria um commit novo, porque a cifra
// usa sal e IV aleatórios). A comparação usa um HMAC com a senha: não revela nada.
const versao = createHmac('sha256', `${usuario}\u0000${senha}`).update(JSON.stringify(lps)).digest('hex');
const destino = join(RAIZ, 'LP', 'index.html');
if (existsSync(destino) && readFileSync(destino, 'utf8').includes(`content="${versao}"`) && !process.argv.includes('--forcar')) {
  console.log('Lista sem mudança; LP/index.html mantido.');
  process.exit(0);
}

const dados = JSON.stringify({ geradaEm: new Date().toISOString(), lps });

const enc = new TextEncoder();
const sal = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey('raw', enc.encode(`${usuario}\u0000${senha}`), 'PBKDF2', false, ['deriveKey']);
const chave = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt: sal, iterations: ITERACOES, hash: 'SHA-256' },
  base,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt'],
);
const cifra = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, enc.encode(dados)));
const b64 = (u8) => Buffer.from(u8).toString('base64');
const pacote = JSON.stringify({ v: 1, it: ITERACOES, sal: b64(sal), iv: b64(iv), dados: b64(cifra) });

const modelo = readFileSync(join(RAIZ, '.github', 'scripts', 'lp-modelo.html'), 'utf8');
if (!modelo.includes('__PACOTE__')) throw new Error('lp-modelo.html sem o marcador __PACOTE__');
mkdirSync(join(RAIZ, 'LP'), { recursive: true });
writeFileSync(destino, modelo.replace('__VERSAO__', versao).replace('__PACOTE__', pacote));
console.log(`LP/index.html gerado com ${lps.length} LP(s).`);
