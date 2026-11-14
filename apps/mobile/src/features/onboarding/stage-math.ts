/**
 * Geometrie der Onboarding-Bühne: Kamera über der Stadtkarte, Lage der Angebotskarte
 * in den drei Schritten (Vorschau am Pin, großes Angebot, 3D-Kreis) und die Übergänge.
 *
 * Alles sind reine Funktionen. Die mit 'worklet' laufen auch im UI-Thread (Reanimated).
 * `progress` geht von 0 (Karte) über 1 (Ort) bis 2 (Kreis) und darf Zwischenwerte haben.
 */
import { normalizeAngle, stepAngle } from './onboarding-logic';

/** Durchmesser des Fotos im Pin. */
export const PIN_SIZE = 48;
/** Spitze unter dem Foto. */
export const PIN_TAIL = 10;
/** Gesamthöhe eines Pins, die Spitze zeigt auf den Ort. */
export const PIN_HEIGHT = PIN_SIZE + PIN_TAIL;
/** So stark wächst der gewählte Pin. */
export const PIN_SELECTED_SCALE = 1.18;
/** So weit ragt der Ort-Sticker über die große Karte hinaus (ungescaled). */
export const STICKER_OUT = 18;
/** Kamera-Zoom auf den Ort im zweiten Schritt. */
export const PLACE_ZOOM = 2.4;

export interface StageGeometry {
  width: number;
  height: number;
  cardWidth: number;
  cardHeight: number;
  /** Großes Angebot (Schritt 2). */
  heroX: number;
  heroY: number;
  heroScale: number;
  /** Wo die Pin-Spitze im Schritt 2 steht: frei über Sticker und Karte. */
  placeY: number;
  /** Größe der Vorschau am Pin (Schritt 1). */
  bubbleScale: number;
  /** Angebotskreis (Schritt 3). */
  wheelX: number;
  wheelY: number;
  wheelScale: number;
  wheelRadius: number;
  /** So weit stehen hintere Karten höher, damit der Kreis nach Raum aussieht. */
  wheelLift: number;
  floorY: number;
}

export interface GeometryInput {
  width: number;
  height: number;
  cardWidth: number;
  cardHeight: number;
}

/** Berechnet alle festen Maße der Bühne aus ihrer Größe und der Kartengröße. */
export function stageGeometry({
  width,
  height,
  cardWidth,
  cardHeight,
}: GeometryInput): StageGeometry {
  const margin = 12;
  // Oben steht der gewählte Pin in voller Größe, darunter Sticker und Karte (skaliert).
  const pinTop = PIN_HEIGHT * PIN_SELECTED_SCALE;
  const pinZone = pinTop + 8;
  const heroBlock = STICKER_OUT + cardHeight;
  const heroScale = Math.max(
    0.3,
    Math.min(1, (height - margin * 2 - pinZone) / heroBlock, (width - margin * 2) / cardWidth),
  );
  const top = (height - pinZone - heroBlock * heroScale) / 2;
  const heroY = top + pinZone + (STICKER_OUT + cardHeight / 2) * heroScale;

  const wheelScale = Math.max(
    0.3,
    Math.min(0.72, (height - 64) / (cardHeight * 1.04), (width * 0.58) / cardWidth),
  );
  const wheelY = height / 2 - 10;

  return {
    width,
    height,
    cardWidth,
    cardHeight,
    heroX: width / 2,
    heroY,
    heroScale,
    placeY: top + pinTop,
    bubbleScale: Math.max(0.3, Math.min(0.46, (height * 0.46) / cardHeight)),
    wheelX: width / 2,
    wheelY,
    wheelScale,
    // Eng genug, dass die seitlichen Karten nicht am Rand abgeschnitten werden.
    wheelRadius: Math.min(cardWidth * wheelScale * 1.1, width * 0.42),
    wheelLift: cardHeight * wheelScale * 0.28,
    floorY: wheelY + (cardHeight * wheelScale) / 2 + 6,
  };
}

export function lerp(from: number, to: number, t: number): number {
  'worklet';
  return from + (to - from) * t;
}

export function clamp01(value: number): number {
  'worklet';
  return Math.min(1, Math.max(0, value));
}

export interface Camera {
  scale: number;
  /** Punkt der Karte (Welt), auf den die Kamera schaut. */
  focusX: number;
  focusY: number;
  /** Wo dieser Punkt auf der Bühne landet. */
  targetX: number;
  targetY: number;
}

/**
 * Kamera über der Karte. Im Schritt 1 steht sie still und zeigt die ganze Karte (ruhig, auch
 * beim Wechseln des Pins). Im Schritt 2 zoomt sie auf den Ort, im Schritt 3 noch ein Stück weiter.
 */
export function cameraAt(
  progress: number,
  focusX: number,
  focusY: number,
  g: StageGeometry,
): Camera {
  'worklet';
  const toPlace = clamp01(progress);
  const beyond = clamp01(progress - 1);
  return {
    scale: lerp(1, PLACE_ZOOM, toPlace) * (1 + 0.35 * beyond),
    focusX,
    focusY,
    targetX: lerp(focusX, g.width / 2, toPlace),
    targetY: lerp(focusY, g.placeY, toPlace),
  };
}

/** Wo ein Punkt der Karte mit dieser Kamera auf der Bühne landet. */
export function project(x: number, y: number, camera: Camera): { x: number; y: number } {
  'worklet';
  return {
    x: camera.targetX + (x - camera.focusX) * camera.scale,
    y: camera.targetY + (y - camera.focusY) * camera.scale,
  };
}

/**
 * Transform für die Kartenfläche (so groß wie die Bühne). React Native skaliert um die
 * Mitte, deshalb wird die Verschiebung so gewählt, dass der Fokus auf dem Ziel landet.
 */
export function mapTransform(
  camera: Camera,
  g: StageGeometry,
): { translateX: number; translateY: number; scale: number } {
  'worklet';
  const cx = g.width / 2;
  const cy = g.height / 2;
  return {
    translateX: camera.targetX - cx - (camera.focusX - cx) * camera.scale,
    translateY: camera.targetY - cy - (camera.focusY - cy) * camera.scale,
    scale: camera.scale,
  };
}

/** Lage einer Karte auf der Bühne (Mittelpunkt, Größe, Drehung). */
export interface Pose {
  x: number;
  y: number;
  scale: number;
  rotateY: number;
  rotateZ: number;
  opacity: number;
  /** 1 = ganz vorne im Kreis, 0 = ganz hinten. */
  depth: number;
}

export function mixPose(a: Pose, b: Pose, t: number): Pose {
  'worklet';
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    scale: lerp(a.scale, b.scale, t),
    rotateY: lerp(a.rotateY, b.rotateY, t),
    rotateZ: lerp(a.rotateZ, b.rotateZ, t),
    opacity: lerp(a.opacity, b.opacity, t),
    depth: lerp(a.depth, b.depth, t),
  };
}

/** Mitte der kleinen Vorschau über dem Pin; passt sie oben nicht hin, kommt sie darunter. */
export function bubbleCenter(
  pinX: number,
  pinY: number,
  g: StageGeometry,
): { x: number; y: number } {
  'worklet';
  const w = g.cardWidth * g.bubbleScale;
  const h = g.cardHeight * g.bubbleScale;
  const edge = 8;
  const gap = 8;
  let y = pinY - PIN_HEIGHT * PIN_SELECTED_SCALE - gap - h / 2;
  if (y - h / 2 < edge) y = pinY + gap + h / 2;
  y = Math.min(g.height - h / 2 - edge, Math.max(h / 2 + edge, y));
  const x = Math.min(g.width - w / 2 - edge, Math.max(w / 2 + edge, pinX));
  return { x, y };
}

/** Vorschau am Pin. `pop` wächst beim Antippen von 0 auf 1 und lässt sie aus dem Pin springen. */
export function bubblePose(pinX: number, pinY: number, pop: number, g: StageGeometry): Pose {
  'worklet';
  const center = bubbleCenter(pinX, pinY, g);
  return {
    x: lerp(pinX, center.x, pop),
    y: lerp(pinY - PIN_HEIGHT / 2, center.y, pop),
    scale: Math.max(0.001, g.bubbleScale * pop),
    rotateY: 0,
    rotateZ: -4,
    opacity: clamp01(pop * 3),
    depth: 1,
  };
}

export function heroPose(g: StageGeometry): Pose {
  'worklet';
  return {
    x: g.heroX,
    y: g.heroY,
    scale: g.heroScale,
    rotateY: 0,
    rotateZ: 0,
    opacity: 1,
    depth: 1,
  };
}

/** Karte `index` im 3D-Kreis bei dieser Drehung (Grad). */
export function wheelPose(index: number, count: number, rotation: number, g: StageGeometry): Pose {
  'worklet';
  const angle = rotation + index * stepAngle(count);
  const radians = (angle * Math.PI) / 180;
  const depth = (Math.cos(radians) + 1) / 2;
  return {
    x: g.wheelX + Math.sin(radians) * g.wheelRadius,
    y: g.wheelY - (1 - depth) * g.wheelLift,
    scale: g.wheelScale * (0.6 + 0.4 * depth),
    rotateY: normalizeAngle(angle),
    rotateZ: 0,
    opacity: 1,
    depth,
  };
}

/**
 * Das gewählte Angebot durch alle drei Schritte: Vorschau am Pin → großes Angebot →
 * vordere Karte im Kreis.
 */
export function leadCardPose(
  progress: number,
  pop: number,
  pinX: number,
  pinY: number,
  rotation: number,
  count: number,
  g: StageGeometry,
): Pose {
  'worklet';
  if (progress <= 1) {
    return mixPose(bubblePose(pinX, pinY, pop, g), heroPose(g), clamp01(progress));
  }
  return mixPose(heroPose(g), wheelPose(0, count, rotation, g), clamp01(progress - 1));
}

/** Die übrigen Karten: liegen hinter dem großen Angebot und fächern sich in den Kreis auf. */
export function orbitCardPose(
  index: number,
  count: number,
  progress: number,
  rotation: number,
  g: StageGeometry,
): Pose {
  'worklet';
  const t = clamp01(progress - 1);
  const hero = heroPose(g);
  const tucked: Pose = { ...hero, scale: hero.scale * 0.8, opacity: 0, depth: 0.5 };
  const pose = mixPose(tucked, wheelPose(index, count, rotation, g), t);
  return { ...pose, opacity: clamp01(t * 1.8) };
}
