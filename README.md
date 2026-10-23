# Brote de Fe — El Viaje de las 73 Raíces

Landing page estática (HTML + CSS) do ebook. Sem build, sem dependências.

## Estrutura

```
index.html          página única
assets/css/         estilos
assets/font/        fontes (.ttf)
assets/image/       imagens (.webp)
assets/copyforge/   interactions.js (FAQ, menus, etc.)
vercel.json         cache dos assets + headers de segurança
```

## Rodar local

```bash
npx serve .
# ou
python3 -m http.server 8000
```

## Deploy na Vercel

1. Suba este repositório no GitHub.
2. Na Vercel: **Add New → Project** → importe o repositório.
3. **Framework Preset:** `Other` · **Build Command:** vazio · **Output Directory:** vazio (raiz).
4. Deploy. Depois, em **Settings → Domains**, adicione `brotedefe.com`.

## Pendências conhecidas

- Links de Privacidade, Termos, Cookies e Reembolsos (rodapé) estão como `href="#"` — criar as páginas ou apontar para URLs reais.
- Texto de garantia/rodapé cita Hotmart, mas o botão de compra aponta para Kiwify — alinhar.
