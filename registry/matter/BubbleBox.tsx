import {
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
} from "react";
import { Bodies, Engine, Render, Runner, World } from "matter-js";

export type BubbleBoxProps = HTMLAttributes<HTMLDivElement> & {
  width?: number;
  height?: number;
};

export function BubbleBox({
  width,
  height,
  style,
  ...divProps
}: BubbleBoxProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const [autoSize, setAutoSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (typeof width === "number" || typeof height === "number") {
      return;
    }

    const wrapper = wrapperRef.current;
    if (!wrapper) {
      return;
    }

    const syncSize = () => {
      setAutoSize({
        width: Math.max(1, Math.floor(wrapper.clientWidth)),
        height: Math.max(1, Math.floor(wrapper.clientHeight)),
      });
    };

    syncSize();
    const observer = new ResizeObserver(syncSize);
    observer.observe(wrapper);

    return () => observer.disconnect();
  }, [width, height]);

  const resolvedWidth = width ?? autoSize.width;
  const resolvedHeight = height ?? autoSize.height;

  useEffect(() => {
    if (!mountRef.current) {
      return;
    }
    if (!resolvedWidth || !resolvedHeight) {
      return;
    }

    mountRef.current.innerHTML = "";

    const engine = Engine.create();
    const render = Render.create({
      element: mountRef.current,
      engine,
      options: {
        width: resolvedWidth,
        height: resolvedHeight,
        wireframes: false,
        background: "transparent",
      },
    });

    const floor = Bodies.rectangle(
      resolvedWidth / 2,
      resolvedHeight + 20,
      resolvedWidth,
      40,
      {
      isStatic: true,
      render: { fillStyle: "#94a3b8" },
      },
    );
    const box = Bodies.rectangle(resolvedWidth / 2, 30, 64, 64, {
      restitution: 0.8,
      render: { fillStyle: "#f97316" },
    });

    World.add(engine.world, [floor, box]);

    const runner = Runner.create();
    Runner.run(runner, engine);
    Render.run(render);

    return () => {
      Render.stop(render);
      Runner.stop(runner);
      World.clear(engine.world, false);
      Engine.clear(engine);
      render.canvas.remove();
      render.textures = {};
    };
  }, [resolvedWidth, resolvedHeight]);

  return (
    <div
      ref={wrapperRef}
      {...divProps}
      style={{
        width: "100%",
        height: "100%",
        minHeight: 240,
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

export default BubbleBox;
