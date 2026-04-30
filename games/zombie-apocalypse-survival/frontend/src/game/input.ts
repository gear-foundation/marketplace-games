type InputState = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fire: boolean;
  firePressed: boolean;
  fireReleased: boolean;
  pausePressed: boolean;
};

const input: InputState = {
  left: false,
  right: false,
  up: false,
  down: false,
  fire: false,
  firePressed: false,
  fireReleased: false,
  pausePressed: false,
};

const handledKeys = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "Spacebar", "Escape"]);

function setDirectional(key: string, value: boolean) {
  if (key === "ArrowLeft") input.left = value;
  if (key === "ArrowRight") input.right = value;
  if (key === "ArrowUp") input.up = value;
  if (key === "ArrowDown") input.down = value;
}

function onKeyDown(event: KeyboardEvent) {
  if (handledKeys.has(event.key)) {
    event.preventDefault();
  }

  setDirectional(event.key, true);

  if ((event.key === " " || event.key === "Spacebar") && !event.repeat) {
    if (!input.fire) {
      input.firePressed = true;
    }
    input.fire = true;
  }

  if (event.key === "Escape" && !event.repeat) {
    input.pausePressed = true;
  }
}

function onKeyUp(event: KeyboardEvent) {
  if (handledKeys.has(event.key)) {
    event.preventDefault();
  }

  setDirectional(event.key, false);

  if (event.key === " " || event.key === "Spacebar") {
    if (input.fire) {
      input.fireReleased = true;
    }
    input.fire = false;
  }
}

export function attachInput() {
  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("keyup", onKeyUp, { passive: false });
}

export function detachInput() {
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
}

export function getInput() {
  return input;
}

export function clearInputFrame() {
  input.firePressed = false;
  input.fireReleased = false;
  input.pausePressed = false;
}

export function resetInput() {
  input.left = false;
  input.right = false;
  input.up = false;
  input.down = false;
  input.fire = false;
  input.firePressed = false;
  input.fireReleased = false;
  input.pausePressed = false;
}
