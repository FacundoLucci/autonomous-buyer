export type SpotlightRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SpotlightLayout = {
  target: SpotlightRect;
  panel: { x: number; y: number };
  connector: { x1: number; y1: number; x2: number; y2: number };
};

const targetPadding = 7;
const panelGap = 24;
const viewportPadding = 12;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, Math.max(min, max)));

/** Closest points on two intervals, sharing the middle of any overlap. */
function nearestIntervalPoints(startA: number, endA: number, startB: number, endB: number) {
  if (endA <= startB) return [endA, startB] as const;
  if (endB <= startA) return [startA, endB] as const;
  const shared = (Math.max(startA, startB) + Math.min(endA, endB)) / 2;
  return [shared, shared] as const;
}

function edgeToward(rect: SpotlightRect, point: { x: number; y: number }) {
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const dx = point.x - centerX;
  const dy = point.y - centerY;
  if (!dx && !dy) return { x: centerX, y: rect.y };
  const scale = Math.min(
    dx ? rect.width / (2 * Math.abs(dx)) : Infinity,
    dy ? rect.height / (2 * Math.abs(dy)) : Infinity,
  );
  return { x: centerX + dx * scale, y: centerY + dy * scale };
}

/**
 * All positions come from current measurements, never step-specific coordinates.
 * Inputs and output share getBoundingClientRect's CSS-pixel coordinate space.
 * The caller constrains the panel's measured size to the available viewport.
 */
export function placeDemoSpotlight(
  target: SpotlightRect,
  viewport: { width: number; height: number; offsetLeft?: number; offsetTop?: number },
  panel: { width: number; height: number },
  headerBottom: number,
): SpotlightLayout {
  const viewportLeft = viewport.offsetLeft ?? 0;
  const viewportTop = viewport.offsetTop ?? 0;
  const viewportRight = viewportLeft + viewport.width;
  const viewportBottom = viewportTop + viewport.height;
  const safeLeft = viewportLeft + viewportPadding;
  const safeRight = viewportRight - viewportPadding;
  const safeBottom = viewportBottom - viewportPadding;
  const safeTop = clamp(
    Math.max(viewportTop, headerBottom) + viewportPadding,
    viewportTop,
    safeBottom,
  );

  const targetLeft = clamp(target.x - targetPadding, viewportLeft, viewportRight);
  const targetRight = clamp(
    target.x + Math.max(0, target.width) + targetPadding,
    targetLeft,
    viewportRight,
  );
  const paddedTarget = {
    x: targetLeft,
    y: target.y - targetPadding,
    width: targetRight - targetLeft,
    height: Math.max(0, target.height) + targetPadding * 2,
  };
  const targetBottom = paddedTarget.y + paddedTarget.height;

  // Keep the aperture attached to the whole element, including tall content.
  // Only the connection and placement use the part currently visible on screen.
  const visibleTop = clamp(paddedTarget.y, safeTop, safeBottom);
  const visibleBottom = clamp(targetBottom, visibleTop, safeBottom);
  const visibleTarget = {
    ...paddedTarget,
    y: visibleTop,
    height: visibleBottom - visibleTop,
  };
  const centerX = paddedTarget.x + paddedTarget.width / 2;
  const centerY = visibleTarget.y + visibleTarget.height / 2;
  const roomRight = safeRight - targetRight;
  const roomLeft = targetLeft - safeLeft;
  const fitsRight = roomRight >= panel.width + panelGap;
  const fitsLeft = roomLeft >= panel.width + panelGap;

  let panelX = centerX - panel.width / 2;
  let panelY: number;

  if (fitsRight || fitsLeft) {
    panelX =
      fitsRight && (!fitsLeft || roomRight >= roomLeft)
        ? targetRight + panelGap
        : targetLeft - panelGap - panel.width;
    panelY = centerY - panel.height / 2;
  } else if (targetBottom + panelGap + panel.height <= safeBottom) {
    panelY = targetBottom + panelGap;
  } else if (paddedTarget.y - panelGap - panel.height >= safeTop) {
    panelY = paddedTarget.y - panelGap - panel.height;
  } else {
    // Full-width or tall evidence docks the guide without resizing the evidence.
    panelY = safeBottom - panel.height;
  }

  panelX = clamp(panelX, safeLeft, safeRight - panel.width);
  panelY = clamp(panelY, safeTop, safeBottom - panel.height);
  const panelRect = { x: panelX, y: panelY, ...panel };

  let [x1, x2] = nearestIntervalPoints(
    visibleTarget.x,
    visibleTarget.x + visibleTarget.width,
    panelX,
    panelX + panel.width,
  );
  let [y1, y2] = nearestIntervalPoints(
    visibleTarget.y,
    visibleTarget.y + visibleTarget.height,
    panelY,
    panelY + panel.height,
  );

  // If docking overlaps a tall target, use facing edges rather than its center.
  if (x1 === x2 && y1 === y2) {
    const from = edgeToward(visibleTarget, {
      x: panelX + panel.width / 2,
      y: panelY + panel.height / 2,
    });
    const to = edgeToward(panelRect, from);
    x1 = from.x;
    y1 = from.y;
    x2 = to.x;
    y2 = to.y;
  }

  return {
    target: paddedTarget,
    panel: { x: panelX, y: panelY },
    connector: { x1, y1, x2, y2 },
  };
}
