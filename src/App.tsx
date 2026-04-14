import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import BubbleBox, { type BubbleProps } from '../registry/matter/BubbleBox'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const [content,] = useState<BubbleProps[]>([
    {
      label: "React",
      textColor: "#61dafb",
      backgroundColor: "#202020",
      shape: "circle",
      initialAngle: 12,
    },
    {
      label: "Vite",
      backgroundColor: "#6366f1",
      shape: "triangle",
      rotate: 4,
      initialAngle: 28,
    },
    {
      label: "Poly5",
      backgroundColor: "#fde68a",
      shape: "polygon",
      polygonSides: 5,
      rotate: 6,
      textRotate: true,
      initialAngle: 22,
    },
    {
      label: "Sunny",
      backgroundColor: "#0f766e",
      shape: "rectangle",
      rotate: 10,
      scale: 0.95,
      initialAngle: 10,
    },
    {
      label: "Ellipse",
      backgroundColor: "#7c3aed",
      shape: "ellipse",
      ellipseAxisRatio: 2,
      rotate: 5,
      initialAngle: 35,
    },
    {
      label: "parallelogram",
      backgroundColor: "transparent",
      shape: "parallelogram",
      skew: 0.55,
      rotate: 3,
      initialAngle: 18,
    },
    {
      label: "Convex",
      textColor: "#111827",
      backgroundColor: "#93c5fd",
      vertices: [
        { x: -1.1, y: -0.2 },
        { x: -0.6, y: -0.95 },
        { x: 0.7, y: -0.8 },
        { x: 1.05, y: 0.05 },
        { x: 0.55, y: 0.95 },
        { x: -0.75, y: 0.45 },
      ],
      rotate: 4,
      scale: 1.05,
    },
  ])

  return (
    <>
      <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
          <img src={reactLogo} className="framework" alt="React logo" />
          <img src={viteLogo} className="vite" alt="Vite logo" />
        </div>
        <div>
          <h1>Get started</h1>
          <p>
            Edit <code>src/App.tsx</code> and save to test <code>HMR</code>
          </p>
        </div>
        <button
          className="counter"
          onClick={() => setCount((count) => count + 1)}
        >
          Count is {count}
        </button>
        <div
          style={{
            width: "min(720px, 92vw)",
            height: 360,
            border: "2px solid #fca5a5",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <BubbleBox
            content={content}
            temperature={36}
            draggable
            fill
            style={{
              backgroundColor: 'transparent'
            }}
          />
        </div>

      </section>
    </>
  )
}

export default App
