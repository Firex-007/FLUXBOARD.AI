/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  FLUXBOARD.AI — ARTracking.ts                                            │
 * │                                                                          │
 * │  Handles the coordinate math for anchoring the 3D circuit scene to a    │
 * │  physical full-size breadboard via a printed ArUco marker mat.           │
 * │                                                                          │
 * │  Strategy:                                                               │
 * │  ┌─────────────────────┐  ← Printed A4 mat                              │
 * │  │[0]   MAT_W=280mm  [1]│     4 ArUco markers at known positions         │
 * │  │                     │     Breadboard sits flush in the centre         │
 * │  │   ┌─BREADBOARD──┐   │     Board = 165mm × 54.6mm                     │
 * │  │   │  60×10 grid │   │                                                 │
 * │  │   └─────────────┘   │                                                 │
 * │  │[3]                [2]│                                                 │
 * │  └─────────────────────┘                                                 │
 * │                                                                          │
 * │  All measurements in mm (real world) mapped to Three.js units            │
 * │  where PITCH = 0.254 = 2.54mm, so 1 Three.js unit = 10mm               │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

import * as THREE from 'three/webgpu';

// ── Physical dimensions (millimetres) ──────────────────────────────────────
export const BOARD_W_MM = 165.0;   // full-size breadboard width (X axis)
export const BOARD_H_MM = 54.6;    // full-size breadboard height (Z axis)
export const MAT_W_MM = 280.0;   // A4 printable mat width
export const MAT_H_MM = 200.0;   // A4 printable mat height
export const MARKER_S_MM = 30.0;    // ArUco marker side length
export const MARGIN_MM = 20.0;    // mat border margin

// ── Scale: 1 Three.js unit = 10 mm  ───────────────────────────────────────
// PITCH = 0.254 units = 2.54 mm ✓
const MM_PER_UNIT = 10.0;

export function mmToUnits(mm: number): number { return mm / MM_PER_UNIT; }
export function unitsToMm(u: number): number { return u * MM_PER_UNIT; }

// ── Breadboard extent in Three.js units ───────────────────────────────────
export const BOARD_W = mmToUnits(BOARD_W_MM);   // = 16.5
export const BOARD_H = mmToUnits(BOARD_H_MM);   //  = 5.46

// ── ArUco marker world positions on the mat (Z-up, mat origin = mat centre)
// Marker ID 0 = top-left, 1 = top-right, 2 = bottom-right, 3 = bottom-left
const matW = mmToUnits(MAT_W_MM);
const matH = mmToUnits(MAT_H_MM);
const markerS = mmToUnits(MARKER_S_MM);
const margin = mmToUnits(MARGIN_MM);

export const MARKER_CORNERS_3D: THREE.Vector3[] = [
    // Marker 0 — top-left  (centre of marker)
    new THREE.Vector3(-matW / 2 + margin + markerS / 2, 0, matH / 2 - margin - markerS / 2),
    // Marker 1 — top-right
    new THREE.Vector3(matW / 2 - margin - markerS / 2, 0, matH / 2 - margin - markerS / 2),
    // Marker 2 — bottom-right
    new THREE.Vector3(matW / 2 - margin - markerS / 2, 0, -matH / 2 + margin + markerS / 2),
    // Marker 3 — bottom-left
    new THREE.Vector3(-matW / 2 + margin + markerS / 2, 0, -matH / 2 + margin + markerS / 2),
];

// ── Printable mat SVG generator ────────────────────────────────────────────
// Generates the SVG markup for the 4-corner ArUco mat so the user can print it.

// Minimal pre-encoded 5×5 ArUco patterns (dictionary 4X4_50, IDs 0-3)
// Each is a 5×5 number grid (1 = black).
const ARUCO_PATTERNS: number[][][] = [
    // ID 0
    [[1, 1, 1, 1, 1], [1, 0, 1, 0, 1], [1, 1, 0, 1, 1], [1, 0, 1, 0, 1], [1, 1, 1, 1, 1]],
    // ID 1
    [[1, 1, 1, 1, 1], [1, 0, 0, 0, 1], [1, 0, 1, 0, 1], [1, 0, 0, 0, 1], [1, 1, 1, 1, 1]],
    // ID 2
    [[1, 1, 1, 1, 1], [1, 1, 0, 1, 1], [1, 0, 0, 0, 1], [1, 1, 0, 1, 1], [1, 1, 1, 1, 1]],
    // ID 3
    [[1, 1, 1, 1, 1], [1, 0, 1, 1, 1], [1, 0, 1, 0, 1], [1, 1, 1, 0, 1], [1, 1, 1, 1, 1]],
];

/** Generate a single ArUco marker as SVG <rect> elements */
function arucoSVG(id: number, x: number, y: number, sizePx: number): string {
    const pattern = ARUCO_PATTERNS[id] ?? ARUCO_PATTERNS[0];
    const cellSize = sizePx / 7;  // 5 data cells + 1-cell quiet zone on each side
    const offset = cellSize;      // quiet zone offset

    const rects: string[] = [];
    // Outer border (white quiet zone is implicit background)
    rects.push(`<rect x="${x}" y="${y}" width="${sizePx}" height="${sizePx}" fill="white"/>`);

    // Black border frame (1-cell wide)
    for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 7; col++) {
            const isBorder = row === 0 || row === 6 || col === 0 || col === 6;
            if (isBorder) {
                rects.push(
                    `<rect x="${x + col * cellSize}" y="${y + row * cellSize}" ` +
                    `width="${cellSize}" height="${cellSize}" fill="black"/>`
                );
            }
        }
    }

    // Data cells (5×5 interior, shifted by 1 quiet zone)
    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
            if (pattern[row][col] === 1) {
                rects.push(
                    `<rect x="${x + offset + col * cellSize}" y="${y + offset + row * cellSize}" ` +
                    `width="${cellSize}" height="${cellSize}" fill="black"/>`
                );
            }
        }
    }

    // ID label
    rects.push(
        `<text x="${x + sizePx / 2}" y="${y + sizePx + 12}" ` +
        `text-anchor="middle" font-size="10" font-family="monospace" fill="#374151">` +
        `ArUco ID:${id}</text>`
    );

    return rects.join('\n');
}

/** Generate the full printable mat as an SVG string */
export function generateMatSVG(): string {
    const W = 794;    // A4 at 96dpi width
    const H = 1123;   // A4 at 96dpi height
    const padX = 60;
    const padY = 60;
    const markerPx = 110;   // marker size in px
    const usableW = W - 2 * padX;
    const usableH = H - 2 * padY;

    // Board area (centred)
    const boardPxW = usableW * 0.8;
    const boardPxH = usableH * 0.35;
    const boardX = padX + (usableW - boardPxW) / 2;
    const boardY = padY + (usableH - boardPxH) / 2;

    const markers = [
        arucoSVG(0, padX, padY, markerPx),
        arucoSVG(1, W - padX - markerPx, padY, markerPx),
        arucoSVG(2, W - padX - markerPx, H - padY - markerPx, markerPx),
        arucoSVG(3, padX, H - padY - markerPx, markerPx),
    ].join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="white"/>
  
  <!-- Title -->
  <text x="${W / 2}" y="30" text-anchor="middle" font-size="18" font-weight="bold" 
        font-family="monospace" fill="#111827">FLUXBOARD.AI — AR Tracking Mat</text>
  <text x="${W / 2}" y="50" text-anchor="middle" font-size="11" 
        font-family="monospace" fill="#6b7280">Print at 100% — do NOT scale | Place breadboard in shaded area</text>
  
  <!-- Breadboard placement zone -->
  <rect x="${boardX}" y="${boardY}" width="${boardPxW}" height="${boardPxH}"
        fill="#f0fdf4" stroke="#22c55e" stroke-width="2" stroke-dasharray="8,4"/>
  <text x="${boardX + boardPxW / 2}" y="${boardY + boardPxH / 2 - 8}" text-anchor="middle"
        font-size="14" font-family="monospace" fill="#16a34a" font-weight="bold">BREADBOARD GOES HERE</text>
  <text x="${boardX + boardPxW / 2}" y="${boardY + boardPxH / 2 + 12}" text-anchor="middle"
        font-size="10" font-family="monospace" fill="#16a34a">165mm × 55mm — Full Size</text>
  
  <!-- 4 corner ArUco markers -->
  ${markers}
  
  <!-- Corner crosshairs for calibration -->
  <line x1="${padX + markerPx / 2}" y1="${padY - 12}" x2="${padX + markerPx / 2}" y2="${padY - 4}" stroke="#94a3b8" stroke-width="1"/>
  <line x1="${padX - 12}" y1="${padY + markerPx / 2}" x2="${padX - 4}" y2="${padY + markerPx / 2}" stroke="#94a3b8" stroke-width="1"/>
  
  <!-- Footer -->
  <text x="${W / 2}" y="${H - 18}" text-anchor="middle" font-size="9"
        font-family="monospace" fill="#9ca3af">fluxboard.ai | ArUco 4X4_50 | IDs 0-3 | 30mm markers</text>
</svg>`;
}

// ── Pose estimation utilities ──────────────────────────────────────────────

/**
 * Given the 4 detected 2D image-plane corners of the mat (in pixels, TL→TR→BR→BL),
 * and the camera intrinsics (focal length, principal point), compute a
 * rough world-space pose as a THREE.Matrix4.
 *
 * Uses a simplified planar homography → decomposition approach.
 * Accurate enough for AR overlay — not a full PnP solver.
 *
 * @param corners2D   4 points [x,y] in image pixels (TL, TR, BR, BL)
 * @param imageW      Camera stream width in pixels
 * @param imageH      Camera stream height in pixels
 * @param fovDeg      Approximate vertical field of view (60° default for phones)
 */
export function estimatePose(
    corners2D: [number, number][],
    imageW: number,
    imageH: number,
    fovDeg: number = 62
): THREE.Matrix4 {

    // Focal length in pixels
    const f = (imageH / 2) / Math.tan((fovDeg * Math.PI / 180) / 2);
    const cx = imageW / 2;
    const cy = imageH / 2;

    // TL and TR of the detected mat
    const [tlX, tlY] = corners2D[0];
    const [trX, trY] = corners2D[1];
    const [brX, brY] = corners2D[2];
    const [blX, blY] = corners2D[3];

    // Mat width in pixels (average of top and bottom edge)
    const topEdgePx = Math.sqrt((trX - tlX) ** 2 + (trY - tlY) ** 2);
    const botEdgePx = Math.sqrt((brX - blX) ** 2 + (brY - blY) ** 2);
    const matWidthPx = (topEdgePx + botEdgePx) / 2;

    // Depth estimation: Z = f * realWidth / pixelWidth
    const Z = f * mmToUnits(MAT_W_MM) / (matWidthPx || 1);

    // Mat centre in image coordinates
    const matCentreX = (tlX + trX + brX + blX) / 4;
    const matCentreY = (tlY + trY + brY + blY) / 4;

    // Mat centre in camera (3D) space
    const X = (matCentreX - cx) * Z / f;
    const Y = (matCentreY - cy) * Z / f;

    // Rotation from horizontal edge vector
    const edgeDx = trX - tlX;
    const edgeDy = trY - tlY;
    const yaw = Math.atan2(edgeDy, edgeDx);  // rotation around Y axis

    // Build transform: camera looks down -Z in Three.js cam coords
    // We apply a flip to convert: cam Y-down → scene Y-up
    const mat = new THREE.Matrix4();
    mat.makeRotationY(-yaw);
    mat.setPosition(X, -Y, -Z);

    return mat;
}

/** No-op identity transform used when AR is not tracking */
export const IDENTITY_POSE = new THREE.Matrix4().identity();
