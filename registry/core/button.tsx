import * as React from "react";

type SunnyButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export function SunnyButton({
  children = "Sunny Button",
  style,
  ...props
}: SunnyButtonProps) {
  return (
    <button
      {...props}
      style={{
        border: "none",
        borderRadius: "12px",
        padding: "10px 18px",
        fontWeight: 600,
        cursor: "pointer",
        background: "linear-gradient(120deg, #f97316, #fb7185)",
        color: "#ffffff",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export default SunnyButton;
