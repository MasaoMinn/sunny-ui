import { useEffect, useRef, type HTMLAttributes } from "react";
import { Bodies, Engine, Render, Runner, World } from "matter-js";

export type BubbleBoxProps = HTMLAttributes<HTMLDivElement> & {
  width?: number;
  height?: number;
};

export function BubbleBox({
  width = 480,
  height = 240,
  style,
  ...divProps
}: BubbleBoxProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) {
      return;
    }

    mountRef.current.innerHTML = "";

    const engine = Engine.create();
    const render = Render.create({
      element: mountRef.current,
      engine,
      options: {
        width,
        height,
        wireframes: false,
        background: "transparent",
      },
    });

    const floor = Bodies.rectangle(width / 2, height + 20, width, 40, {
      isStatic: true,
      render: { fillStyle: "#94a3b8" },
    });
    const box = Bodies.rectangle(width / 2, 30, 64, 64, {
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
  }, [width, height]);

  return (
    <div
      {...divProps}
      style={{
        width: "fit-content",
        border: "1px solid #e2e8f0",
        borderRadius: 16,
        overflow: "hidden",
        background: "#f8fafc",
        ...style,
      }}
    >
      <div ref={mountRef} />
    </div>
  );
}

export default BubbleBox;
