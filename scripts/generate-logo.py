"""
Fanxy logo generator — pure Python stdlib (no Pillow).

Design brief:
  - Background : #1a1a2e  (matches game BOARD_BG for visual consistency)
  - F letter   : #FF5C3A  (vibrant coral-orange — warm, energetic, high-contrast)
  - Highlight  : #FFD700  (gold sparkle pixels — nod to pixel-art game aesthetic)

32×32 layout (pixel coordinates, 0-indexed):
  Top bar   : x 7..24,  y 5..8   (18 × 4 px)
  Left stem : x 7..10,  y 5..26  (4 × 22 px)
  Mid bar   : x 7..18,  y 14..17 (12 × 4 px)
  Sparkles  : (26,2)  (28,7)  (25,12)

128×128 → 4× upscale of 32×32
512×512 → 16× upscale of 32×32
"""

import struct
import zlib
import os

BG      = (26,  26,  46)   # #1a1a2e
F_COLOR = (255, 92,  58)   # #FF5C3A
SPARKLE = (255, 215, 0)    # #FFD700


def make_base_grid() -> list[list[tuple[int, int, int]]]:
    SIZE = 32
    grid: list[list[tuple[int, int, int]]] = [[BG] * SIZE for _ in range(SIZE)]

    # top bar
    for y in range(5, 9):
        for x in range(7, 25):
            grid[y][x] = F_COLOR

    # left stem
    for y in range(5, 27):
        for x in range(7, 11):
            grid[y][x] = F_COLOR

    # middle bar
    for y in range(14, 18):
        for x in range(7, 19):
            grid[y][x] = F_COLOR

    # gold sparkles
    grid[2][26] = SPARKLE
    grid[7][28] = SPARKLE
    grid[12][25] = SPARKLE

    return grid


def upscale(grid: list, factor: int) -> list:
    result = []
    for row in grid:
        new_row = []
        for pixel in row:
            new_row.extend([pixel] * factor)
        for _ in range(factor):
            result.append(new_row[:])
    return result


def write_png(path: str, grid: list) -> None:
    height = len(grid)
    width  = len(grid[0])

    def chunk(kind: bytes, data: bytes) -> bytes:
        body = kind + data
        return struct.pack('>I', len(data)) + body + struct.pack('>I', zlib.crc32(body) & 0xFFFF_FFFF)

    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))

    raw = bytearray()
    for row in grid:
        raw.append(0)            # filter: None
        for r, g, b in row:
            raw += bytes([r, g, b])

    idat = chunk(b'IDAT', zlib.compress(bytes(raw), level=9))
    iend = chunk(b'IEND', b'')

    with open(path, 'wb') as fh:
        fh.write(b'\x89PNG\r\n\x1a\n' + ihdr + idat + iend)

    print(f'  written: {path}  ({width}×{height})')


def main() -> None:
    out_dir = os.path.join(os.path.dirname(__file__), '..', 'public')
    os.makedirs(out_dir, exist_ok=True)

    base = make_base_grid()
    write_png(os.path.join(out_dir, 'fanxy-logo-32.png'),  base)
    write_png(os.path.join(out_dir, 'fanxy-logo-128.png'), upscale(base, 4))
    write_png(os.path.join(out_dir, 'fanxy-logo-512.png'), upscale(base, 16))

    print('\nPalette:')
    print('  Background : #1a1a2e')
    print('  F letter   : #FF5C3A')
    print('  Sparkle    : #FFD700')


if __name__ == '__main__':
    main()
