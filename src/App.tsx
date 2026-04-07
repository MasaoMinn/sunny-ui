import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import BubbleBox from '../registry/matter/BubbleBox'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const [content,] = useState([
    {
      label: "React",
      textColor: "#61dafb",
      backgroundColor: "#202020",
      shape: "circle",
      rotate: 2,
      scale: 1,
      textRotate: false,
    },
    {
      label: "Vite",
      textColor: "#ffffff",
      backgroundColor: "#6366f1",
      shape: "triangle",
      rotate: 4,
      scale: 1.05,
      textRotate: true,
    },
    {
      label: "Matter",
      textColor: "#0f172a",
      backgroundColor: "#fde68a",
      shape: "starshape",
      rotate: 6,
      scale: 1.15,
      textRotate: true,
    },
    {
      label: "Sunny",
      textColor: "#ffffff",
      backgroundColor: "#0f766e",
      shape: "rectangle",
      rotate: 3,
      scale: 0.95,
      textRotate: false,
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
            temperature={50}
            draggable
            fill
          />
        </div>

      </section>
    </>
  )
}

export default App
