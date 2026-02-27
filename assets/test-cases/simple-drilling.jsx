import React from "react";

// Simple prop drilling test case: one prop drilled through 2 levels

function Parent({ userName, onSave }) {
  return (
    <div>
      <Middle userName={userName} onSave={onSave} />
    </div>
  );
}

function Middle({ userName, onSave }) {
  return (
    <div>
      <Child userName={userName} onSave={onSave} />
    </div>
  );
}

function Child({ userName, onSave }) {
  return (
    <div>
      <p>{userName}</p>
      <button onClick={onSave}>Save</button>
    </div>
  );
}

export default Parent;
