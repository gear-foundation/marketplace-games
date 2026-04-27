export type InputState = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fire: boolean;
  fireJustPressed: boolean;
};

const state: InputState = {
  left: false,
  right: false,
  up: false,
  down: false,
  fire: false,
  fireJustPressed: false,
};

function onKeyDown(e: KeyboardEvent) {
  switch (e.code) {
    case "ArrowLeft":
    case "KeyA":
      e.preventDefault();
      state.left = true;
      break;
    case "ArrowRight":
    case "KeyD":
      e.preventDefault();
      state.right = true;
      break;
    case "ArrowUp":
    case "KeyW":
      e.preventDefault();
      state.up = true;
      break;
    case "ArrowDown":
    case "KeyS":
      e.preventDefault();
      state.down = true;
      break;
    case "Space":
      e.preventDefault();
      if (!state.fire) state.fireJustPressed = true;
      state.fire = true;
      break;
  }
}

function onKeyUp(e: KeyboardEvent) {
  switch (e.code) {
    case "ArrowLeft":
    case "KeyA":
      state.left = false;
      break;
    case "ArrowRight":
    case "KeyD":
      state.right = false;
      break;
    case "ArrowUp":
    case "KeyW":
      state.up = false;
      break;
    case "ArrowDown":
    case "KeyS":
      state.down = false;
      break;
    case "Space":
      state.fire = false;
      break;
  }
}

export function attachInput() {
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
}

export function detachInput() {
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
}

export function getInput(): InputState {
  return state;
}

export function clearJustPressed() {
  state.fireJustPressed = false;
}

export function resetInput() {
  state.left = false;
  state.right = false;
  state.up = false;
  state.down = false;
  state.fire = false;
  state.fireJustPressed = false;
}
