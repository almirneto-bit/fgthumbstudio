# FG Thumb Studio v01

Editor simultâneo de thumbs para os dois formatos definidos na page `Test_SM-Thumb` do Figma:

- Instagram em 1080 × 1920 px
- TikTok em 1080 × 1440 px

## Recursos

- Uma imagem compartilhada entre as duas thumbs.
- Zoom e posicionamento independentes para cada formato.
- Três linhas de texto com sequência fixa: branca, laranja e branca.
- Bloco de texto ancorado pela linha inferior e crescimento para cima.
- Seta sempre vinculada à última linha e usando a mesma cor dela.
- Sombras superior e inferior independentes.
- Camada de cor ativa em 5% por padrão.
- Noise com intensidade e tamanho do grão.
- Margem de segurança de 88 px visível apenas na prévia.
- Histórico local das cinco criações mais recentes, sem nuvem.
- Exportação individual em PNG ou conjunta em ZIP.

## Executar

Requer Node.js 20.9 ou superior.

```bash
npm ci
npm run dev
```

## Validar

```bash
npm run typecheck
npm run build
```

Para hospedagem estática, defina `STATIC_EXPORT=1`. Caso o site seja publicado em uma subpasta, defina também `PAGES_BASE_PATH`.
