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
const DEFAULT_HEIGHT = 240;
const DEFAULT_TEXT_COLOR = "#ffffff";
const DEFAULT_SCALE = 1;
const STAR_INNER_RATIO = 0.5;

const BUBBLE_COLORS = [
  "#38bdf8",
  "#22d3ee",
  "#34d399",
  "#fbbf24",
  "#fb7185",
  "#a78bfa",
];

type BubbleShape = "circle" | "triangle" | "rectangle" | "starshape";

export type BubbleContentItem = {
  label?: string;
  lable?: string;
  textColor?: string;
  "text-color"?: string;
  backgroundColor?: string;
  "background-color"?: string;
  shape?: string;
  rotate?: number;
  scale?: number;
  textRotate?: boolean;
};

type NormalizedBubble = {
  label: string;
  textColor: string;
  backgroundColor: string;
  shape: BubbleShape;
  rotate: number;
  scale: number;
  textRotate: boolean;
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
  content: Array<string | BubbleContentItem>;
  temperature?: number;
  draggable?: boolean;
  width?: number;
  height?: number;
};

export function BubbleBox({
  content,
  temperature = 60,
  draggable = false,
  width,
  height,
  style,
  ...divProps
}: BubbleBoxProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const [autoSize, setAutoSize] = useState({ width: 0, height: 0 });

  const normalizedContent = useMemo<NormalizedBubble[]>(
    () => content.map((item, index) => normalizeBubbleItem(item, index)),
    [content],
  );
  const normalizedTemperature = clamp(temperature, 0, 100);
  const targetSpeed = (normalizedTemperature / 100) * MAX_SPEED;

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) {
      return;
    }

    if (typeof width === "number" && typeof height === "number") {
      return;
    }

    const updateSize = () => {
      setAutoSize({
        width: Math.max(1, Math.floor(wrapper.clientWidth)),
        height: Math.max(1, Math.floor(wrapper.clientHeight)),
      });
    };

    updateSize();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(updateSize);
    observer.observe(wrapper);

    return () => observer.disconnect();
  }, [width, height]);

  const resolvedWidth = Math.max(1, Math.floor(width ?? autoSize.width ?? 0));
  const resolvedHeight = Math.max(
    1,
    Math.floor(height ?? autoSize.height ?? DEFAULT_HEIGHT),
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
        width: "100%",
        height: "100%",
        minHeight: DEFAULT_HEIGHT,
        border: "1px solid #e2e8f0",
        borderRadius: 16,
        overflow: "hidden",
        background: "#f8fafc",
        ...style,
      }}
    >
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

function createBubbleGeometry(
  item: NormalizedBubble,
  index: number,
  baseRadius: number,
): BubbleGeometry {
  const sizeRadius = Math.max(MIN_RADIUS * 0.45, baseRadius * item.scale);
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

  if (item.shape === "triangle") {
    const circumRadius = sizeRadius * 1.555;
    const body = Bodies.polygon(0, 0, 3, circumRadius, bodyOptions);
    return {
      body,
      collisionRadius: circumRadius,
      textRadius: sizeRadius * 0.78,
    };
  }

  if (item.shape === "rectangle") {
    const halfWidth = sizeRadius * 0.97;
    const halfHeight = sizeRadius * 0.81;
    const body = Bodies.rectangle(0, 0, halfWidth * 2, halfHeight * 2, bodyOptions);
    return {
      body,
      collisionRadius: Math.hypot(halfWidth, halfHeight),
      textRadius: Math.min(halfWidth, halfHeight),
    };
  }

  if (item.shape === "starshape") {
    const outerRadius = sizeRadius * 1.462;
    const innerRadius = outerRadius * STAR_INNER_RATIO;
    const vertices = createStarVertices(0, 0, outerRadius, innerRadius, 5);
    const body = Bodies.fromVertices(0, 0, [vertices], bodyOptions, true);
    body.label = `bubble-star-${index}`;
    return {
      body,
      collisionRadius: outerRadius,
      textRadius: innerRadius * 0.95,
    };
  }

  const body = Bodies.circle(0, 0, sizeRadius, bodyOptions);
  return {
    body,
    collisionRadius: sizeRadius,
    textRadius: sizeRadius,
  };
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

function createStarVertices(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  spikes: number,
) {
  const vertices: Array<{ x: number; y: number }> = [];
  const step = Math.PI / spikes;
  let angle = -Math.PI / 2;

  for (let i = 0; i < spikes; i += 1) {
    vertices.push({
      x: cx + Math.cos(angle) * outerRadius,
      y: cy + Math.sin(angle) * outerRadius,
    });
    angle += step;
    vertices.push({
      x: cx + Math.cos(angle) * innerRadius,
      y: cy + Math.sin(angle) * innerRadius,
    });
    angle += step;
  }

  return vertices;
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

function normalizeBubbleItem(
  item: string | BubbleContentItem,
  index: number,
): NormalizedBubble {
  if (typeof item === "string") {
    return {
      label: item,
      textColor: DEFAULT_TEXT_COLOR,
      backgroundColor: BUBBLE_COLORS[index % BUBBLE_COLORS.length],
      shape: "circle",
      rotate: 0,
      scale: DEFAULT_SCALE,
      textRotate: false,
    };
  }

  return {
    label: String(item.label ?? item.lable ?? ""),
    textColor: item.textColor ?? item["text-color"] ?? DEFAULT_TEXT_COLOR,
    backgroundColor:
      item.backgroundColor ??
      item["background-color"] ??
      BUBBLE_COLORS[index % BUBBLE_COLORS.length],
    shape: normalizeShape(item.shape),
    rotate: clamp(item.rotate ?? 0, 0, 10),
    scale: clamp(item.scale ?? DEFAULT_SCALE, 0.4, 3),
    textRotate: Boolean(item.textRotate),
  };
}

function normalizeShape(input: string | undefined): BubbleShape {
  const value = String(input ?? "circle").trim().toLowerCase();
  if (value === "triangle") {
    return "triangle";
  }
  if (value === "rectangle" || value === "rect" || value === "square") {
    return "rectangle";
  }
  if (value === "starshape" || value === "star" || value === "star-shape") {
    return "starshape";
  }
  return "circle";
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

function resolveRange(min: number, max: number, fallback: number) {
  if (min <= max) {
    return [min, max] as const;
  }
  return [fallback, fallback] as const;
}

export default BubbleBox;
