#!/usr/bin/env python3
"""
Busca noticias juridicas em feeds RSS publicos e gera data/noticias.json.

Este script roda de forma agendada via GitHub Actions (ver
.github/workflows/atualizar-noticias.yml) -- nao depende de nenhum
servidor proprio nem de conta paga. Usa apenas a biblioteca padrao do
Python, entao nao ha dependencia externa para instalar.

Fontes verificadas manualmente em 27/07/2026:
  - ConJur: possui feed RSS publico e ativo em /rss.xml
  - JOTA: possui feed RSS publico e ativo em /feed (atencao: traz tambem
    cobertura de politica geral, alem de Direito -- filtre se quiser
    manter o feed 100% juridico)
  - Migalhas: nao foi encontrado um feed RSS publico no site atual.
    Se descobrir a URL certa, so adicionar na lista FONTES abaixo.
"""
import json
import re
import urllib.request
import urllib.error
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import xml.etree.ElementTree as ET

FONTES = [
    {"nome": "ConJur", "url": "https://www.conjur.com.br/rss.xml"},
    {"nome": "JOTA", "url": "https://www.jota.info/feed"},
    # Adicione outras fontes aqui, no mesmo formato, assim que confirmar
    # que elas publicam um feed RSS valido.
]

MAX_ITENS_TOTAL = 15     # quantas noticias aparecem no site, no total
MAX_ITENS_POR_FONTE = 8  # limite por fonte, para uma nao dominar a lista
TIMEOUT_SEGUNDOS = 15
SAIDA = "data/noticias.json"


def limpar_html(texto):
    """Remove tags HTML e entidades comuns de um trecho de descrição de RSS."""
    texto = re.sub(r"<[^>]+>", "", texto or "")
    texto = (
        texto.replace("&#8230;", "…")
        .replace("&nbsp;", " ")
        .replace("&#8220;", '"')
        .replace("&#8221;", '"')
        .replace("&#8217;", "'")
        .replace("&amp;", "&")
    )
    return re.sub(r"\s+", " ", texto).strip()


def truncar(texto, limite=220):
    if len(texto) <= limite:
        return texto
    cortado = texto[:limite].rsplit(" ", 1)[0]
    return cortado + "…"


def buscar_feed(fonte):
    req = urllib.request.Request(
        fonte["url"],
        headers={"User-Agent": "Mozilla/5.0 (compatible; GurgelGusmaoNoticias/1.0)"},
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT_SEGUNDOS) as resp:
        dados = resp.read()

    raiz = ET.fromstring(dados)
    itens = []
    for item in raiz.findall("./channel/item")[:MAX_ITENS_POR_FONTE]:
        titulo = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        data_pub_bruta = item.findtext("pubDate")
        descricao = limpar_html(item.findtext("description") or "")

        try:
            dt = parsedate_to_datetime(data_pub_bruta)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
        except Exception:
            dt = datetime.now(timezone.utc)

        if not titulo or not link:
            continue

        itens.append(
            {
                "fonte": fonte["nome"],
                "titulo": titulo,
                "link": link,
                "data": dt.isoformat(),
                "resumo": truncar(descricao),
            }
        )
    return itens


def carregar_existentes():
    """Lê o data/noticias.json atual (já curado/mesclado), se existir."""
    try:
        with open(SAIDA, encoding="utf-8") as f:
            dados = json.load(f)
        return dados.get("itens", [])
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def main():
    existentes = carregar_existentes()
    links_existentes = {item.get("link") for item in existentes}

    novos = []
    for fonte in FONTES:
        try:
            itens = buscar_feed(fonte)
            itens_novos = [i for i in itens if i["link"] not in links_existentes]
            novos.extend(itens_novos)
            print(f"[ok] {fonte['nome']}: {len(itens)} lidos, {len(itens_novos)} novos")
        except urllib.error.URLError as e:
            print(f"[aviso] falha de rede ao buscar {fonte['nome']}: {e}")
        except ET.ParseError as e:
            print(f"[aviso] XML invalido em {fonte['nome']}: {e}")
        except Exception as e:
            print(f"[aviso] erro inesperado em {fonte['nome']}: {e}")

    # Mescla: mantém o que já estava no arquivo (inclusive edições manuais
    # de resumo/título feitas na curadoria) e acrescenta só o que é
    # realmente novo. Nada é sobrescrito às cegas.
    todos = existentes + novos
    todos.sort(key=lambda x: x["data"], reverse=True)
    todos = todos[:MAX_ITENS_TOTAL]

    saida = {
        "atualizado_em": datetime.now(timezone.utc).isoformat(),
        "itens": todos,
    }

    import os
    os.makedirs("data", exist_ok=True)
    with open(SAIDA, "w", encoding="utf-8") as f:
        json.dump(saida, f, ensure_ascii=False, indent=2)

    print(f"OK: {len(todos)} noticias no total ({len(novos)} novas nesta execucao)")


if __name__ == "__main__":
    main()
