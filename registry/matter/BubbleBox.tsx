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
const BUBBLE_COLORS = [
  "#38bdf8",
  "#22d3ee",
  "#34d399",
  "#fbbf24",
  "#fb7185",
  "#a78bfa",
];

export type BubbleContentItem = {
  label?: string;
  lable?: string;
  textColor?: string;
  "text-color"?: string;
  backgroundColor?: string;
  "background-color"?: string;
};

type NormalizedBubble = {
  label: string;
  textColor: string;
  backgroundColor: string;
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
    () =>
      content.map((item, index) => normalizeBubbleItem(item, index)),
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
    const radius = calculateBubbleRadius(resolvedWidth, resolvedHeight, bubbleCount);
    const wallThickness = Math.max(24, Math.round(radius * 1.8));
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
      bubbleCount,
      resolvedWidth,
      resolvedHeight,
      radius,
    );
    const bubbles = normalizedContent.map((bubbleItem, index) => {
      const point = spawnPoints[index];
      return Bodies.circle(point.x, point.y, radius, {
        restitution: 1,
        friction: 0,
        frictionStatic: 0,
        frictionAir: 0,
        slop: 0,
        inertia: Infinity,
        render: {
          fillStyle: bubbleItem.backgroundColor,
          strokeStyle: "#ffffff",
          lineWidth: 1.5,
        },
      });
    });

    for (const bubble of bubbles) {
      setBodySpeed(bubble, targetSpeed);
    }

    World.add(engine.world, [...walls, ...bubbles]);

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

    const keepConstantSpeed = () => {
      for (const bubble of bubbles) {
        if (draggingBody === bubble) {
          continue;
        }
        setBodySpeed(bubble, targetSpeed);
      }
    };

    const drawBubbleText = () => {
      const context = render.context;
      const fontSize = clamp(radius * 0.5, 10, 24);

      context.save();
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;

      bubbles.forEach((bubble, index: number) => {
        context.fillStyle = normalizedContent[index]?.textColor ?? "#ffffff";
        const text = fitText(
          context,
          normalizedContent[index]?.label ?? "",
          radius * 1.55,
        );
        context.fillText(text, bubble.position.x, bubble.position.y);
      });

      context.restore();
    };

    Events.on(engine, "afterUpdate", keepConstantSpeed);
    Events.on(render, "afterRender", drawBubbleText);

    const runner = Runner.create();
    Runner.run(runner, engine);
    Render.run(render);

    return () => {
      if (mouseConstraint && onStartDrag && onEndDrag) {
        Events.off(mouseConstraint, "startdrag", onStartDrag);
        Events.off(mouseConstraint, "enddrag", onEndDrag);
      }
      Events.off(engine, "afterUpdate", keepConstantSpeed);
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
  count: number,
  width: number,
  height: number,
  radius: number,
) {
  if (count <= 0) {
    return [];
  }

  const cols = Math.ceil(Math.sqrt((count * width) / height));
  const rows = Math.ceil(count / cols);
  const margin = radius + 6;
  const usableWidth = Math.max(0, width - margin * 2);
  const usableHeight = Math.max(0, height - margin * 2);
  const stepX = cols === 1 ? 0 : usableWidth / (cols - 1);
  const stepY = rows === 1 ? 0 : usableHeight / (rows - 1);

  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const jitter = Math.min(radius * 0.15, 6);
    const x = margin + col * stepX + randomBetween(-jitter, jitter);
    const y = margin + row * stepY + randomBetween(-jitter, jitter);

    return {
      x: clamp(x, margin, width - margin),
      y: clamp(y, margin, height - margin),
    };
  });
}

function calculateBubbleRadius(width: number, height: number, count: number) {
  if (count <= 0) {
    return MIN_RADIUS;
  }

  const cols = Math.ceil(Math.sqrt((count * width) / height));
  const rows = Math.ceil(count / cols);
  const byGrid = Math.min(width / cols, height / rows) * 0.36;
  const byArea = Math.sqrt((width * height * 0.24) / (Math.PI * count));
  const maxRadius = Math.min(width, height) * 0.2;

  return clamp(Math.floor(Math.min(byGrid, byArea, maxRadius)), MIN_RADIUS, 80);
}

function fitText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  if (!text) {
    return "";
  }
  if (context.measureText(text).width <= maxWidth) {
    return text;
  }

  const ellipsis = "...";
  let low = 0;
  let high = text.length;

  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const candidate = `${text.slice(0, mid)}${ellipsis}`;
    if (context.measureText(candidate).width <= maxWidth) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return `${text.slice(0, low)}${ellipsis}`;
}

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
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

function normalizeBubbleItem(
  item: string | BubbleContentItem,
  index: number,
): NormalizedBubble {
  if (typeof item === "string") {
    return {
      label: item,
      textColor: "#ffffff",
      backgroundColor: BUBBLE_COLORS[index % BUBBLE_COLORS.length],
    };
  }

  return {
    label: String(item.label ?? item.lable ?? ""),
    textColor: item.textColor ?? item["text-color"] ?? "#ffffff",
    backgroundColor:
      item.backgroundColor ??
      item["background-color"] ??
      BUBBLE_COLORS[index % BUBBLE_COLORS.length],
  };
}

export default BubbleBox;
