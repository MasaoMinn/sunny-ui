import { useEffect, useMemo, useRef, useState, type HTMLAttributes } from "react";
import {
  Bodies,
  Body,
  Engine,
  Events,
  Mouse,
  MouseConstraint,
  Render,
  Runner,
  World,
  type Body as MatterBody,
} from "matter-js";

const MAX_SPEED = 6;
const MIN_RADIUS = 12;
const DEFAULT_WIDTH = 480;
const DEFAULT_HEIGHT = 320;
const DEFAULT_TEXT_COLOR = "#ffffff";
const DEFAULT_SCALE = 1;
const DEFAULT_ELLIPSE_AXIS_RATIO = 1.6;

const BUBBLE_COLORS = [
  "#38bdf8",
  "#22d3ee",
  "#34d399",
  "#fbbf24",
  "#fb7185",
  "#a78bfa",
];

type Vertex2D = {
  x: number;
  y: number;
};

export type BubbleShape =
  | "circle"
  | "triangle"
  | "rectangle"
  | "trapezoid"
  | "polygon"
  | "ellipse"
  | "parallelogram";

export type BubbleProps = {
  label: string;
  lable?: string;
  textColor?: string;
  backgroundColor?: string;
  shape?: BubbleShape;
  polygonSides?: number;
  trapezoidSlope?: number;
  ellipseAxisRatio?: number;
  skew?: number;
  vertices?: Vertex2D[] | null;
  rotate?: number;
  scale?: number;
  textRotate?: boolean;
  initialAngle?: number;
};

type NormalizedBubble = {
  label: string;
  textColor: string;
  backgroundColor: string;
  shape: BubbleShape;
  polygonSides: number;
  trapezoidSlope: number;
  ellipseAxisRatio: number;
  skew: number;
  vertices: Vertex2D[] | null;
  rotate: number;
  scale: number;
  textRotate: boolean;
  initialAngle: number;
};

type BubbleGeometry = {
  body: MatterBody;
  collisionRadius: number;
  textRadius: number;
};

type BubbleRuntime = {
  body: MatterBody;
  label: string;
  textColor: string;
  textMaxWidth: number;
  spinVelocity: number;
  textRotate: boolean;
};

export type BubbleBoxProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children" | "content"
> & {
  content: BubbleProps[];
  temperature?: number;
  draggable?: boolean;
  fill?: boolean;
  width?: number | string;
  height?: number | string;
};

export function BubbleBox({
  content,
  temperature = 60,
  draggable = false,
  fill = false,
  width,
  height,
  style,
  ...divProps
}: BubbleBoxProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const [autoSize, setAutoSize] = useState({ width: 0, height: 0 });

  const normalizedContent = useMemo<NormalizedBubble[]>(
    () => content.map((item) => normalizeBubbleProps(item)),
    [content],
  );
  const normalizedTemperature = clamp(temperature, 0, 100);
  const targetSpeed = (normalizedTemperature / 100) * MAX_SPEED;
  const hasExplicitWidth = hasSizeValue(width);
  const hasExplicitHeight = hasSizeValue(height);
  const explicitPixelWidth = toPositiveNumber(width);
  const explicitPixelHeight = toPositiveNumber(height);
  const cssWidth = hasExplicitWidth ? toCssSize(width, "100%") : "100%";
  const cssHeight = hasExplicitHeight
    ? toCssSize(height, `${DEFAULT_HEIGHT}px`)
    : fill
      ? "100%"
      : `${DEFAULT_HEIGHT}px`;

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) {
      return;
    }

    const updateSize = () => {
      const rect = wrapper.getBoundingClientRect();
      const measuredWidth = Math.max(1, Math.floor(rect.width || wrapper.clientWidth));
      const measuredHeight = Math.max(
        1,
        Math.floor(rect.height || wrapper.clientHeight),
      );

      const nextWidth = explicitPixelWidth ?? measuredWidth ?? DEFAULT_WIDTH;
      const nextHeight =
        explicitPixelHeight ??
        (measuredHeight > 1 ? measuredHeight : DEFAULT_HEIGHT);

      setAutoSize((prev) => {
        if (prev.width === nextWidth && prev.height === nextHeight) {
          return prev;
        }
        return { width: nextWidth, height: nextHeight };
      });
    };

    updateSize();

    if (explicitPixelWidth && explicitPixelHeight) {
      return;
    }

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(updateSize);
    observer.observe(wrapper);

    return () => observer.disconnect();
  }, [explicitPixelHeight, explicitPixelWidth, fill]);

  const resolvedWidth = Math.max(
    1,
    Math.floor(explicitPixelWidth ?? autoSize.width ?? DEFAULT_WIDTH),
  );
  const resolvedHeight = Math.max(
    1,
    Math.floor(explicitPixelHeight ?? autoSize.height ?? DEFAULT_HEIGHT),
  );

  useEffect(() => {
    const mountNode = mountRef.current;
    if (!mountNode || resolvedWidth <= 0 || resolvedHeight <= 0) {
      return;
    }

    mountNode.innerHTML = "";

    const engine = Engine.create({
      gravity: { x: 0, y: 0, scale: 0 },
      enableSleeping: false,
    });

    const render = Render.create({
      element: mountNode,
      engine,
      options: {
        width: resolvedWidth,
        height: resolvedHeight,
        wireframes: false,
        background: "transparent",
      },
    });

    const bubbleCount = normalizedContent.length;
    const baseRadius = calculateBubbleRadius(
      resolvedWidth,
      resolvedHeight,
      bubbleCount,
    );

    const bubbleGeometries = normalizedContent.map((item, index) =>
      createBubbleGeometry(item, index, baseRadius),
    );

    const maxCollisionRadius = bubbleGeometries.reduce(
      (acc, item) => Math.max(acc, item.collisionRadius),
      MIN_RADIUS,
    );
    const wallThickness = Math.max(24, Math.round(maxCollisionRadius * 1.8));
    const walls = [
      Bodies.rectangle(
        resolvedWidth / 2,
        -wallThickness / 2,
        resolvedWidth + wallThickness * 2,
        wallThickness,
        createWallOptions(),
      ),
      Bodies.rectangle(
        resolvedWidth / 2,
        resolvedHeight + wallThickness / 2,
        resolvedWidth + wallThickness * 2,
        wallThickness,
        createWallOptions(),
      ),
      Bodies.rectangle(
        -wallThickness / 2,
        resolvedHeight / 2,
        wallThickness,
        resolvedHeight + wallThickness * 2,
        createWallOptions(),
      ),
      Bodies.rectangle(
        resolvedWidth + wallThickness / 2,
        resolvedHeight / 2,
        wallThickness,
        resolvedHeight + wallThickness * 2,
        createWallOptions(),
      ),
    ];

    const spawnPoints = createSpawnPoints(
      bubbleGeometries.map((item) => item.collisionRadius),
      resolvedWidth,
      resolvedHeight,
      6,
    );

    const bubbles: BubbleRuntime[] = bubbleGeometries.map((geometry, index) => {
      const point = spawnPoints[index];
      Body.setPosition(geometry.body, { x: point.x, y: point.y });
      Body.setAngle(
        geometry.body,
        toRadians(normalizedContent[index]?.initialAngle ?? 0),
      );
      setBodySpeed(geometry.body, targetSpeed);

      return {
        body: geometry.body,
        label: normalizedContent[index]?.label ?? "",
        textColor: normalizedContent[index]?.textColor ?? DEFAULT_TEXT_COLOR,
        textMaxWidth: geometry.textRadius * 1.82,
        spinVelocity:
          ((index % 2 === 0 ? 1 : -1) *
            clamp(normalizedContent[index]?.rotate ?? 0, 0, 10)) /
          120,
        textRotate: Boolean(normalizedContent[index]?.textRotate),
      };
    });

    World.add(engine.world, [...walls, ...bubbles.map((item) => item.body)]);

    let draggingBody: MatterBody | null = null;
    let mouseConstraint: MouseConstraint | null = null;
    let onStartDrag: ((event: unknown) => void) | null = null;
    let onEndDrag: ((event: unknown) => void) | null = null;

    if (draggable) {
      const mouse = Mouse.create(render.canvas);
      mouseConstraint = MouseConstraint.create(engine, {
        mouse,
        constraint: {
          stiffness: 0.2,
          damping: 0.12,
          render: { visible: false },
        },
      });
      render.mouse = mouse;
      World.add(engine.world, mouseConstraint);

      onStartDrag = (event) => {
        draggingBody = extractBodyFromEvent(event);
      };
      onEndDrag = (event) => {
        const body = extractBodyFromEvent(event);
        draggingBody = null;
        if (body) {
          setBodySpeed(body, targetSpeed);
        }
      };

      Events.on(mouseConstraint, "startdrag", onStartDrag);
      Events.on(mouseConstraint, "enddrag", onEndDrag);
    }

    const maintainMotion = () => {
      for (const bubble of bubbles) {
        if (draggingBody === bubble.body) {
          continue;
        }
        setBodySpeed(bubble.body, targetSpeed);
        if (bubble.spinVelocity === 0) {
          Body.setAngularVelocity(bubble.body, 0);
        } else {
          Body.setAngularVelocity(bubble.body, bubble.spinVelocity);
        }
      }
    };

    const drawBubbleText = () => {
      const context = render.context;
      const maxFontSize = clamp(baseRadius * 0.48, 10, 24);

      context.save();
      context.textAlign = "center";
      context.textBaseline = "middle";

      for (const bubble of bubbles) {
        const fittedFontSize = getFittedFontSize(
          context,
          bubble.label,
          bubble.textMaxWidth,
          maxFontSize,
        );

        context.save();
        context.translate(bubble.body.position.x, bubble.body.position.y);
        if (bubble.textRotate) {
          context.rotate(bubble.body.angle);
        }
        context.fillStyle = bubble.textColor;
        context.font = `600 ${fittedFontSize}px system-ui, -apple-system, sans-serif`;
        context.fillText(bubble.label, 0, 0);
        context.restore();
      }

      context.restore();
    };

    Events.on(engine, "afterUpdate", maintainMotion);
    Events.on(render, "afterRender", drawBubbleText);

    const runner = Runner.create();
    Runner.run(runner, engine);
    Render.run(render);

    return () => {
      if (mouseConstraint && onStartDrag && onEndDrag) {
        Events.off(mouseConstraint, "startdrag", onStartDrag);
        Events.off(mouseConstraint, "enddrag", onEndDrag);
      }
      Events.off(engine, "afterUpdate", maintainMotion);
      Events.off(render, "afterRender", drawBubbleText);
      Render.stop(render);
      Runner.stop(runner);
      World.clear(engine.world, false);
      Engine.clear(engine);
      render.canvas.remove();
      render.textures = {};
    };
  }, [draggable, normalizedContent, resolvedHeight, resolvedWidth, targetSpeed]);

  return (
    <div
      ref={wrapperRef}
      {...divProps}
      style={{
        width: cssWidth,
        height: cssHeight,
        maxWidth: hasExplicitWidth ? undefined : "100%",
        boxSizing: "border-box",
        border: "1px solid #e2e8f0",
        overflow: "hidden",
        background: "#f8fafc",
        ...style,
      }}
    >
      <div
        ref={mountRef}
        style={{ width: "100%", height: "100%", boxSizing: "border-box" }}
      />
    </div>
  );
}

function createBubbleGeometry(
  item: NormalizedBubble,
  index: number,
  baseRadius: number,
): BubbleGeometry {
  const sizeRadius = Math.max(MIN_RADIUS * 0.45, baseRadius * item.scale);
  const referenceArea = Math.PI * sizeRadius * sizeRadius;
  const bodyOptions = {
    restitution: 1,
    friction: 0,
    frictionStatic: 0,
    frictionAir: 0,
    slop: 0,
    render: {
      fillStyle: item.backgroundColor,
      strokeStyle: "#ffffff",
      lineWidth: 1.5,
    },
  };

  if (item.vertices && item.vertices.length >= 3) {
    const scaledVertices = item.vertices.map((vertex) => ({
      x: vertex.x * sizeRadius,
      y: vertex.y * sizeRadius,
    }));
    const body = Bodies.fromVertices(0, 0, [scaledVertices], bodyOptions, true);
    body.label = `bubble-convex-${index}`;
    return measureBubbleGeometry(body, 0.82);
  }

  if (item.shape === "triangle") {
    const polygonRadius = equivalentPolygonRadius(sizeRadius, 3);
    const body = Bodies.polygon(0, 0, 3, polygonRadius, bodyOptions);
    return measureBubbleGeometry(body, 0.8);
  }

  if (item.shape === "polygon") {
    const sides = clampInt(item.polygonSides, 3, 12);
    const polygonRadius = equivalentPolygonRadius(sizeRadius, sides);
    const body = Bodies.polygon(0, 0, sides, polygonRadius, bodyOptions);
    return measureBubbleGeometry(body, 0.86);
  }

  if (item.shape === "ellipse") {
    const majorMinorRatio = normalizeEllipseAxisRatio(item.ellipseAxisRatio);
    const scaleX = Math.sqrt(majorMinorRatio);
    const scaleY = 1 / scaleX;
    const body = Bodies.circle(0, 0, sizeRadius, bodyOptions);
    Body.scale(body, scaleX, scaleY);
    return measureBubbleGeometry(body, 0.74);
  }

  if (item.shape === "rectangle") {
    const aspect = 1.22;
    const rectWidth = Math.sqrt(referenceArea * aspect);
    const rectHeight = referenceArea / rectWidth;
    const body = Bodies.rectangle(0, 0, rectWidth, rectHeight, bodyOptions);
    return measureBubbleGeometry(body, 0.85);
  }

  if (item.shape === "trapezoid") {
    const slope = clamp(item.trapezoidSlope, 0.1, 0.45);
    const aspect = 1.18;
    const width = Math.sqrt((referenceArea * aspect) / (1 - slope));
    const height = width / aspect;
    const body = Bodies.trapezoid(0, 0, width, height, slope, bodyOptions);
    return measureBubbleGeometry(body, 0.8);
  }

  if (item.shape === "parallelogram") {
    const aspect = 1.2;
    const width = Math.sqrt(referenceArea * aspect);
    const height = referenceArea / width;
    const offset = clamp(item.skew, -1, 1) * width * 0.32;
    const vertices = [
      { x: -width / 2 + offset, y: -height / 2 },
      { x: width / 2 + offset, y: -height / 2 },
      { x: width / 2 - offset, y: height / 2 },
      { x: -width / 2 - offset, y: height / 2 },
    ];
    const body = Bodies.fromVertices(0, 0, [vertices], bodyOptions, true);
    body.label = `bubble-parallelogram-${index}`;
    return measureBubbleGeometry(body, 0.8);
  }

  const body = Bodies.circle(0, 0, sizeRadius, bodyOptions);
  return measureBubbleGeometry(body, 0.9);
}

function setBodySpeed(body: MatterBody, speed: number) {
  if (speed <= 0) {
    Body.setVelocity(body, { x: 0, y: 0 });
    return;
  }

  const { x, y } = body.velocity;
  const currentSpeed = Math.hypot(x, y);

  if (currentSpeed < 0.001) {
    const angle = Math.random() * Math.PI * 2;
    Body.setVelocity(body, {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed,
    });
    return;
  }

  Body.setVelocity(body, {
    x: (x / currentSpeed) * speed,
    y: (y / currentSpeed) * speed,
  });
}

function createWallOptions() {
  return {
    isStatic: true,
    restitution: 1,
    friction: 0,
    frictionStatic: 0,
    frictionAir: 0,
    slop: 0,
    render: { visible: false },
  };
}

function createSpawnPoints(
  radii: number[],
  width: number,
  height: number,
  gap: number,
) {
  const points: Array<{ x: number; y: number }> = Array.from(
    { length: radii.length },
    () => ({ x: width / 2, y: height / 2 }),
  );

  const order = radii
    .map((radius, index) => ({ radius, index }))
    .sort((a, b) => b.radius - a.radius);

  const placed: Array<{ x: number; y: number; radius: number }> = [];

  for (let i = 0; i < order.length; i += 1) {
    const { index, radius } = order[i];
    const [minX, maxX] = resolveRange(
      radius + gap,
      width - radius - gap,
      width / 2,
    );
    const [minY, maxY] = resolveRange(
      radius + gap,
      height - radius - gap,
      height / 2,
    );

    let position: { x: number; y: number } | null = null;

    for (let attempt = 0; attempt < 240; attempt += 1) {
      const x = randomBetween(minX, maxX);
      const y = randomBetween(minY, maxY);
      if (hasCollision(x, y, radius, placed, gap)) {
        continue;
      }
      position = { x, y };
      break;
    }

    if (!position) {
      const fallback = fallbackGridPoint(i, order.length, width, height, radius, gap);
      position = { x: fallback.x, y: fallback.y };
    }

    points[index] = position;
    placed.push({ x: position.x, y: position.y, radius });
  }

  return points;
}

function hasCollision(
  x: number,
  y: number,
  radius: number,
  placed: Array<{ x: number; y: number; radius: number }>,
  gap: number,
) {
  for (const item of placed) {
    const distance = Math.hypot(x - item.x, y - item.y);
    if (distance < radius + item.radius + gap) {
      return true;
    }
  }
  return false;
}

function fallbackGridPoint(
  index: number,
  total: number,
  width: number,
  height: number,
  radius: number,
  gap: number,
) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(total)));
  const rows = Math.max(1, Math.ceil(total / cols));
  const col = index % cols;
  const row = Math.floor(index / cols);

  const minX = radius + gap;
  const maxX = width - radius - gap;
  const minY = radius + gap;
  const maxY = height - radius - gap;
  const [safeMinX, safeMaxX] = resolveRange(minX, maxX, width / 2);
  const [safeMinY, safeMaxY] = resolveRange(minY, maxY, height / 2);
  const stepX = cols === 1 ? 0 : (safeMaxX - safeMinX) / (cols - 1);
  const stepY = rows === 1 ? 0 : (safeMaxY - safeMinY) / (rows - 1);

  return {
    x: clamp(safeMinX + col * stepX, safeMinX, safeMaxX),
    y: clamp(safeMinY + row * stepY, safeMinY, safeMaxY),
  };
}

function calculateBubbleRadius(width: number, height: number, count: number) {
  if (count <= 0) {
    return MIN_RADIUS;
  }

  const cols = Math.ceil(Math.sqrt((count * width) / height));
  const rows = Math.ceil(count / cols);
  const byGrid = Math.min(width / cols, height / rows) * 0.28;
  const byArea = Math.sqrt((width * height * 0.2) / (Math.PI * count));
  const maxRadius = Math.min(width, height) * 0.16;

  return clamp(Math.floor(Math.min(byGrid, byArea, maxRadius)), MIN_RADIUS, 80);
}

function measureBubbleGeometry(body: MatterBody, textRadiusScale: number): BubbleGeometry {
  const halfWidth = (body.bounds.max.x - body.bounds.min.x) / 2;
  const halfHeight = (body.bounds.max.y - body.bounds.min.y) / 2;
  const collisionRadius = Math.hypot(halfWidth, halfHeight);
  const textRadius = Math.max(
    MIN_RADIUS * 0.5,
    Math.min(halfWidth, halfHeight) * textRadiusScale,
  );

  return {
    body,
    collisionRadius,
    textRadius,
  };
}

function equivalentPolygonRadius(referenceRadius: number, sides: number) {
  const n = Math.max(3, sides);
  const denominator = n * Math.sin((Math.PI * 2) / n);
  return referenceRadius * Math.sqrt((Math.PI * 2) / denominator);
}

function getFittedFontSize(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxFontSize: number,
) {
  if (!text) {
    return maxFontSize;
  }

  let low = 1;
  let high = Math.max(1, Math.floor(maxFontSize));
  let best = 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    context.font = `600 ${mid}px system-ui, -apple-system, sans-serif`;
    const width = context.measureText(text).width;
    if (width <= maxWidth) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}

function normalizeConvexVertices(
  vertices: Vertex2D[] | null | undefined,
): Vertex2D[] | null {
  if (!vertices || vertices.length < 3) {
    return null;
  }

  const numericVertices = vertices
    .map((vertex) => ({ x: Number(vertex.x), y: Number(vertex.y) }))
    .filter((vertex) => Number.isFinite(vertex.x) && Number.isFinite(vertex.y));

  const uniqueMap = new Map<string, Vertex2D>();
  for (const vertex of numericVertices) {
    uniqueMap.set(`${vertex.x.toFixed(6)}:${vertex.y.toFixed(6)}`, vertex);
  }
  const uniqueVertices = Array.from(uniqueMap.values());
  if (uniqueVertices.length < 3) {
    return null;
  }

  const hull = convexHull(uniqueVertices);
  if (hull.length < 3) {
    return null;
  }

  const centroid = hull.reduce(
    (acc, vertex) => ({ x: acc.x + vertex.x, y: acc.y + vertex.y }),
    { x: 0, y: 0 },
  );
  const centerX = centroid.x / hull.length;
  const centerY = centroid.y / hull.length;

  const centered = hull.map((vertex) => ({
    x: vertex.x - centerX,
    y: vertex.y - centerY,
  }));

  const maxDistance = centered.reduce(
    (acc, vertex) => Math.max(acc, Math.hypot(vertex.x, vertex.y)),
    0,
  );
  if (maxDistance <= 0.0001) {
    return null;
  }

  return centered.map((vertex) => ({
    x: vertex.x / maxDistance,
    y: vertex.y / maxDistance,
  }));
}

function convexHull(points: Vertex2D[]): Vertex2D[] {
  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  if (sorted.length <= 3) {
    return sorted;
  }

  const lower: Vertex2D[] = [];
  for (const point of sorted) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0
    ) {
      lower.pop();
    }
    lower.push(point);
  }

  const upper: Vertex2D[] = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const point = sorted[i];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0
    ) {
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();

  return [...lower, ...upper];
}

function cross(a: Vertex2D, b: Vertex2D, c: Vertex2D) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function normalizeBubbleProps(item: BubbleProps): NormalizedBubble {
  const shape = normalizeShape(item.shape);
  const polygonSides = clampInt(item.polygonSides ?? 6, 3, 12);
  const normalizedVertices = normalizeConvexVertices(item.vertices);
  const normalizedLabel = String(item.label ?? item.lable ?? "").trim();

  return {
    label: normalizedLabel,
    textColor: item.textColor || DEFAULT_TEXT_COLOR,
    backgroundColor: item.backgroundColor || BUBBLE_COLORS[0],
    shape,
    polygonSides,
    trapezoidSlope: clamp(item.trapezoidSlope ?? 0.25, 0.1, 0.45),
    ellipseAxisRatio: normalizeEllipseAxisRatio(item.ellipseAxisRatio),
    skew: clamp(item.skew ?? 0, -1, 1),
    vertices: normalizedVertices,
    rotate: clamp(item.rotate ?? 0, 0, 10),
    scale: clamp(item.scale ?? DEFAULT_SCALE, 0.4, 3),
    textRotate: Boolean(item.textRotate),
    initialAngle: normalizeAngle(item.initialAngle),
  };
}

function normalizeShape(input: string | undefined): BubbleShape {
  const value = String(input ?? "circle").trim().toLowerCase();
  if (value === "triangle") {
    return "triangle";
  }
  if (value === "trapezoid") {
    return "trapezoid";
  }
  if (value === "polygon") {
    return "polygon";
  }
  if (value === "ellipse") {
    return "ellipse";
  }
  if (value === "parallelogram") {
    return "parallelogram";
  }
  if (value === "rectangle" || value === "rect" || value === "square") {
    return "rectangle";
  }
  return "circle";
}

function normalizeEllipseAxisRatio(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value === 0) {
    return DEFAULT_ELLIPSE_AXIS_RATIO;
  }
  const ratio = Math.abs(value);
  const majorMinorRatio = ratio < 1 ? 1 / ratio : ratio;
  return clamp(majorMinorRatio, 1, 4);
}

function normalizeAngle(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function extractBodyFromEvent(event: unknown): MatterBody | null {
  if (!event || typeof event !== "object") {
    return null;
  }

  const body = (event as { body?: unknown }).body;
  if (!body || typeof body !== "object") {
    return null;
  }

  return body as MatterBody;
}

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.round(clamp(value, min, max));
}

function resolveRange(min: number, max: number, fallback: number) {
  if (min <= max) {
    return [min, max] as const;
  }
  return [fallback, fallback] as const;
}

function toPositiveNumber(value: number | string | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return undefined;
  }
  if (value <= 0) {
    return undefined;
  }
  return value;
}

function toCssSize(value: number | string | undefined, fallback: string) {
  if (typeof value === "number") {
    return `${value}px`;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  return fallback;
}

function hasSizeValue(value: number | string | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return false;
}

export default BubbleBox;
