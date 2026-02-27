import React from "react";

// No prop drilling — each component only uses its own props

function Dashboard({ title }) {
  return (
    <div>
      <h1>{title}</h1>
    </div>
  );
}

function Sidebar({ items }) {
  return (
    <ul>
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export { Dashboard, Sidebar };
