import { describe, expect, it } from 'vitest';

import {
  bubbleCenter,
  cameraAt,
  leadCardPose,
  mapTransform,
  orbitCardPose,
  PIN_HEIGHT,
  PIN_SELECTED_SCALE,
  project,
  stageGeometry,
  STICKER_OUT,
  wheelPose,
} from './stage-math';

const g = stageGeometry({ width: 340, height: 360, cardWidth: 280, cardHeight: 300 });

describe('stageGeometry', () => {
  it('passt Pin, Sticker und großes Angebot untereinander in die Bühne', () => {
    expect(g.heroScale).toBeLessThanOrEqual(1);
    const pinTop = g.placeY - PIN_HEIGHT * PIN_SELECTED_SCALE;
    const stickerTop = g.heroY - (g.cardHeight / 2 + STICKER_OUT) * g.heroScale;
    const cardBottom = g.heroY + (g.cardHeight / 2) * g.heroScale;
    expect(pinTop).toBeGreaterThanOrEqual(0);
    expect(g.placeY).toBeLessThanOrEqual(stickerTop);
    expect(cardBottom).toBeLessThanOrEqual(g.height);
  });

  it('macht die Karten im Kreis kleiner als das große Angebot', () => {
    expect(g.wheelScale).toBeLessThan(g.heroScale);
    expect(g.bubbleScale).toBeLessThan(g.wheelScale);
  });
});

describe('Kamera', () => {
  it('steht im Schritt 1 still, egal welcher Pin gewählt ist', () => {
    const camera = cameraAt(0, 50, 80, g);
    expect(project(120, 200, camera)).toEqual({ x: 120, y: 200 });
    const transform = mapTransform(camera, g);
    expect(transform.scale).toBe(1);
    expect(transform.translateX).toBeCloseTo(0);
    expect(transform.translateY).toBeCloseTo(0);
  });

  it('bringt den gewählten Ort im Schritt 2 über die Karte', () => {
    const camera = cameraAt(1, 60, 300, g);
    const pin = project(60, 300, camera);
    expect(pin.x).toBeCloseTo(g.width / 2);
    expect(pin.y).toBeCloseTo(g.placeY);
  });

  it('verschiebt die Kartenfläche passend zur Projektion', () => {
    const camera = cameraAt(0.6, 60, 300, g);
    const { translateX, translateY, scale } = mapTransform(camera, g);
    // Punkt der Fläche nach RN-Transform: Mitte + Verschiebung + (Punkt − Mitte) · Zoom
    const point = { x: 200, y: 100 };
    const viaTransform = {
      x: g.width / 2 + translateX + (point.x - g.width / 2) * scale,
      y: g.height / 2 + translateY + (point.y - g.height / 2) * scale,
    };
    const viaProject = project(point.x, point.y, camera);
    expect(viaTransform.x).toBeCloseTo(viaProject.x);
    expect(viaTransform.y).toBeCloseTo(viaProject.y);
  });
});

describe('Lage der Karten', () => {
  it('setzt die Vorschau über den Pin und unter ihn, wenn oben kein Platz ist', () => {
    const above = bubbleCenter(170, 300, g);
    expect(above.y).toBeLessThan(300);
    const below = bubbleCenter(170, 40, g);
    expect(below.y).toBeGreaterThan(40);
  });

  it('hält die Vorschau seitlich in der Bühne', () => {
    const center = bubbleCenter(2, 300, g);
    expect(center.x - (g.cardWidth * g.bubbleScale) / 2).toBeGreaterThanOrEqual(0);
  });

  it('führt das gewählte Angebot vom Pin über die Mitte in den Kreis', () => {
    const start = leadCardPose(0, 1, 100, 300, 0, 5, g);
    const middle = leadCardPose(1, 1, 100, 300, 0, 5, g);
    const end = leadCardPose(2, 1, 100, 300, 0, 5, g);
    expect(start.scale).toBeCloseTo(g.bubbleScale);
    expect(middle.scale).toBeCloseTo(g.heroScale);
    expect(middle.x).toBeCloseTo(g.width / 2);
    expect(end).toEqual(wheelPose(0, 5, 0, g));
  });

  it('versteckt die übrigen Karten bis zum Kreis', () => {
    expect(orbitCardPose(2, 5, 1, 0, g).opacity).toBe(0);
    expect(orbitCardPose(2, 5, 2, 0, g).opacity).toBe(1);
  });

  it('stellt im Kreis die vordere Karte nach vorne und die hintere nach hinten', () => {
    const front = wheelPose(0, 4, 0, g);
    const back = wheelPose(2, 4, 0, g);
    expect(front.depth).toBeCloseTo(1);
    expect(back.depth).toBeCloseTo(0);
    expect(back.scale).toBeLessThan(front.scale);
    expect(Math.abs(back.rotateY)).toBeCloseTo(180);
  });
});
