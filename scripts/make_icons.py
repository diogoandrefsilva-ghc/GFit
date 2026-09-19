#!/usr/bin/env python3
"""
Gera os ícones da app a partir do logótipo em brand/gfit-logo.png.

O logótipo tem duas partes: as silhuetas em cima e a palavra "GFit" em baixo.
Num ícone de 192 px a palavra fica ilegível, por isso o ícone usa só as
silhuetas; a palavra fica no logótipo completo, usado no ecrã de entrada.

    pip install pillow && python3 scripts/make_icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "brand" / "gfit-logo.png"
PUBLIC = ROOT / "public"

# Caixa das silhuetas dentro do logótipo (medida no ficheiro de origem), já
# sem a palavra em baixo.
FIGURES = (150, 130, 1105, 770)
BLACK = (0, 0, 0)


def figures(padding: float) -> Image.Image:
    """As silhuetas num quadrado preto, a ocuparem 1 - padding do lado."""
    source = Image.open(SOURCE).convert("RGB")
    crop = source.crop(FIGURES)

    side = int(max(crop.size) / (1 - padding))
    canvas = Image.new("RGB", (side, side), BLACK)
    canvas.paste(
        crop,
        ((side - crop.width) // 2, (side - crop.height) // 2),
    )
    return canvas


def rounded(image: Image.Image, size: int, radius_ratio: float) -> Image.Image:
    """Redimensiona e arredonda os cantos (fundo transparente por fora)."""
    out = image.resize((size, size), Image.LANCZOS).convert("RGBA")
    mask = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, size * 4 - 1, size * 4 - 1),
        radius=int(size * 4 * radius_ratio),
        fill=255,
    )
    out.putalpha(mask.resize((size, size), Image.LANCZOS))
    return out


def save(image: Image.Image, name: str) -> None:
    """Grava em PNG de paleta: o desenho tem poucas cores (preto, dourado,
    prateado) e assim ocupa uma fracção — tudo isto entra na cache da PWA."""
    path = PUBLIC / name
    image.quantize(colors=256).save(path, "PNG", optimize=True)
    print(f"{path.relative_to(ROOT)}  {image.size[0]}×{image.size[1]}  "
          f"{path.stat().st_size // 1024} KB")


def main() -> None:
    # Ícone normal: cantos arredondados, porque aparece tal e qual no separador
    # do browser e no ecrã de instalação.
    art = figures(padding=0.16)
    save(rounded(art, 512, 0.22), "icon-512.png")
    save(rounded(art, 192, 0.22), "icon-192.png")

    # Maskable: o sistema recorta a forma que quiser, por isso o desenho tem de
    # caber no círculo central (80% do lado) e o fundo vai até às bordas.
    save(figures(padding=0.38).resize((512, 512), Image.LANCZOS), "icon-512-maskable.png")

    # iOS arredonda o ícone sozinho: quadrado cheio, sem transparência.
    save(figures(padding=0.22).resize((180, 180), Image.LANCZOS), "apple-touch-icon.png")

    # Logótipo completo (silhuetas + palavra) para o ecrã de entrada.
    save(
        Image.open(SOURCE).convert("RGB").resize((512, 512), Image.LANCZOS),
        "logo-gfit.png",
    )


if __name__ == "__main__":
    main()
