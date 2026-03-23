// 3x5 pixel bitmap font for digits 0-9.
// Each entry: 5 rows, each row is a 3-bit mask.
// Bit ordering: bit 2 (MSB) = leftmost pixel, bit 0 = rightmost pixel.
const DIGIT_BITMAPS: Readonly<Record<string, readonly number[]>> = {
  '0': [0b110, 0b101, 0b101, 0b101, 0b110],
  '1': [0b010, 0b110, 0b010, 0b010, 0b111],
  '2': [0b110, 0b001, 0b011, 0b100, 0b111],
  '3': [0b110, 0b001, 0b011, 0b001, 0b110],
  '4': [0b101, 0b101, 0b111, 0b001, 0b001],
  '5': [0b111, 0b100, 0b110, 0b001, 0b110],
  '6': [0b011, 0b100, 0b110, 0b101, 0b011],
  '7': [0b111, 0b001, 0b010, 0b010, 0b010],
  '8': [0b111, 0b101, 0b111, 0b101, 0b111],
  '9': [0b011, 0b101, 0b011, 0b001, 0b010],
  '+': [0b000, 0b010, 0b111, 0b010, 0b000],
  'x': [0b000, 0b101, 0b010, 0b101, 0b000],
  'C': [0b011, 0b100, 0b100, 0b100, 0b011],
  'O': [0b010, 0b101, 0b101, 0b101, 0b010],
  'M': [0b101, 0b111, 0b111, 0b101, 0b101],
  'B': [0b110, 0b101, 0b110, 0b101, 0b110],
  '!': [0b010, 0b010, 0b010, 0b000, 0b010],
} as const

const CHAR_W = 3
const CHAR_H = 5
const CHAR_GAP = 1

// Draws a numeric string centered at (cx, cy).
// pixelSize: display pixels per logical pixel (should be integer for crisp art).
export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  color: string,
  pixelSize: number,
): void {
  const chars = text.split('')
  const totalW = chars.length * CHAR_W + Math.max(0, chars.length - 1) * CHAR_GAP
  const startX = Math.round(cx - (totalW * pixelSize) / 2)
  const startY = Math.round(cy - (CHAR_H * pixelSize) / 2)
  ctx.fillStyle = color
  for (let ci = 0; ci < chars.length; ci++) {
    const ch = chars[ci]
    if (ch === undefined) continue
    const bitmap = DIGIT_BITMAPS[ch]
    if (bitmap === undefined) continue
    const charX = startX + ci * (CHAR_W + CHAR_GAP) * pixelSize
    for (let row = 0; row < CHAR_H; row++) {
      const rowBits = bitmap[row] ?? 0
      for (let col = 0; col < CHAR_W; col++) {
        if (rowBits & (1 << (CHAR_W - 1 - col))) {
          ctx.fillRect(charX + col * pixelSize, startY + row * pixelSize, pixelSize, pixelSize)
        }
      }
    }
  }
}
