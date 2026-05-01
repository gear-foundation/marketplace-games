#!/usr/bin/env python3
"""Template level generator and BFS verifier for Robo. Save Eny!"""

from __future__ import annotations

import argparse
import json
from collections import deque
from pathlib import Path
from typing import Iterable

Direction = str
Position = tuple[int, int]
State = tuple[int, int, tuple[Position, ...], bool]

DELTAS: dict[Direction, Position] = {
    "up": (0, -1),
    "down": (0, 1),
    "left": (-1, 0),
    "right": (1, 0),
}


def add(pos: Position, direction: Direction) -> Position:
    dx, dy = DELTAS[direction]
    return pos[0] + dx, pos[1] + dy


def inside(level: dict, pos: Position) -> bool:
    return 0 <= pos[0] < level["width"] and 0 <= pos[1] < level["height"]


def is_wall(level: dict, pos: Position) -> bool:
    if not inside(level, pos):
        return True
    return level["tiles"][pos[1]][pos[0]] == "#"


def laser_guns(level: dict) -> set[Position]:
    return {(laser["x"], laser["y"]) for laser in level["objects"]["lasers"]}


def laser_cells(level: dict, stones: Iterable[Position]) -> set[Position]:
    stone_set = set(stones)
    gun_set = laser_guns(level)
    cells: set[Position] = set()

    for laser in level["objects"]["lasers"]:
        current = add((laser["x"], laser["y"]), laser["direction"])
        while inside(level, current):
            if is_wall(level, current) or current in stone_set or current in gun_set:
                break
            cells.add(current)
            current = add(current, laser["direction"])

    return cells


def canonical_stones(stones: Iterable[Position]) -> tuple[Position, ...]:
    return tuple(sorted(stones))


def solve(level: dict, allow_pushes: bool = True, max_states: int = 1_000_000) -> dict:
    robo = (level["objects"]["robo"]["x"], level["objects"]["robo"]["y"])
    eny = (level["objects"]["eny"]["x"], level["objects"]["eny"]["y"])
    exit_pos = (level["objects"]["exit"]["x"], level["objects"]["exit"]["y"])
    start: State = (
        robo[0],
        robo[1],
        canonical_stones((stone["x"], stone["y"]) for stone in level["objects"]["stones"]),
        False,
    )

    queue = deque([(start, 0, 0)])
    seen = {start}
    guns = laser_guns(level)

    while queue and len(seen) <= max_states:
        state, steps, pushes = queue.popleft()
        rx, ry, stones_tuple, has_eny = state
        stones = set(stones_tuple)

        if has_eny and (rx, ry) == exit_pos:
            return {"solved": True, "steps": steps, "pushes": pushes}

        for direction in DELTAS:
            next_robo = add((rx, ry), direction)
            if is_wall(level, next_robo) or next_robo in guns:
                continue

            next_stones = set(stones)
            did_push = False
            if next_robo in stones:
                if not allow_pushes:
                    continue
                next_stone = add(next_robo, direction)
                if (
                    is_wall(level, next_stone)
                    or next_stone in guns
                    or next_stone in stones
                    or (not has_eny and next_stone == eny)
                ):
                    continue
                next_stones.remove(next_robo)
                next_stones.add(next_stone)
                did_push = True

            if next_robo in laser_cells(level, next_stones):
                continue

            next_has_eny = has_eny or next_robo == eny
            next_state: State = (
                next_robo[0],
                next_robo[1],
                canonical_stones(next_stones),
                next_has_eny,
            )

            if next_state in seen:
                continue

            seen.add(next_state)
            queue.append((next_state, steps + 1, pushes + (1 if did_push else 0)))

    return {"solved": False, "steps": 0, "pushes": 0}


def base_tiles(width: int = 10, height: int = 8) -> list[str]:
    return ["#" * width, *["#" + "." * (width - 2) + "#" for _ in range(height - 2)], "#" * width]


def with_walls(tiles: list[str], walls: Iterable[Position]) -> list[str]:
    mutable = [list(row) for row in tiles]
    for x, y in walls:
        mutable[y][x] = "#"
    return ["".join(row) for row in mutable]


def make_template_level(level_id: int) -> dict:
    variants = [
        {"mirror": False, "stone_x": 3, "walls": [(8, 4)]},
        {"mirror": False, "stone_x": 4, "walls": [(8, 4), (7, 5)]},
        {"mirror": True, "stone_x": 6, "walls": [(1, 4)]},
        {"mirror": False, "stone_x": 5, "walls": [(8, 4), (1, 5)]},
        {"mirror": True, "stone_x": 5, "walls": [(1, 4), (8, 5)]},
        {"mirror": False, "stone_x": 6, "walls": [(8, 4), (2, 6)]},
        {"mirror": True, "stone_x": 4, "walls": [(1, 4), (7, 6)]},
        {"mirror": False, "stone_x": 7, "walls": [(8, 4), (2, 5)]},
        {"mirror": True, "stone_x": 3, "walls": [(1, 4), (7, 5)]},
        {"mirror": False, "stone_x": 3, "walls": [(8, 4), (6, 1)]},
        {"mirror": True, "stone_x": 6, "walls": [(1, 4), (3, 1)]},
        {"mirror": False, "stone_x": 4, "walls": [(8, 4), (6, 5)]},
        {"mirror": True, "stone_x": 5, "walls": [(1, 4), (3, 5)]},
        {"mirror": False, "stone_x": 5, "walls": [(8, 4), (2, 1), (7, 6)]},
        {"mirror": True, "stone_x": 4, "walls": [(1, 4), (7, 1), (2, 6)]},
        {"mirror": False, "stone_x": 6, "walls": [(8, 4), (1, 5), (7, 1)]},
        {"mirror": True, "stone_x": 3, "walls": [(1, 4), (8, 5), (2, 1)]},
        {"mirror": False, "stone_x": 7, "walls": [(8, 4), (1, 3), (2, 6)]},
        {"mirror": True, "stone_x": 6, "walls": [(1, 4), (8, 3), (7, 6)]},
        {"mirror": False, "stone_x": 4, "walls": [(8, 4), (1, 5), (7, 5), (6, 1)]},
    ]
    variant = variants[(level_id - 1) % len(variants)]
    mirror = variant["mirror"]
    stone_x = variant["stone_x"]
    laser_x = 8 if mirror else 1
    laser_direction = "left" if mirror else "right"
    eny_x = 1 if mirror else 8
    exit_x = 8 if mirror else 1
    difficulty = "easy" if level_id <= 8 else "medium" if level_id <= 15 else "hard"

    return {
        "id": level_id,
        "width": 10,
        "height": 8,
        "tiles": with_walls(base_tiles(), variant["walls"]),
        "objects": {
            "robo": {"x": stone_x, "y": 5},
            "eny": {"x": eny_x, "y": 2},
            "exit": {"x": exit_x, "y": 6},
            "stones": [{"x": stone_x, "y": 4}],
            "lasers": [{"x": laser_x, "y": 2, "direction": laser_direction}],
        },
        "rules": {"goal": "save_eny_then_exit", "stonesBlockLasers": True},
        "meta": {
            "template": "stone_blocks_laser",
            "difficulty": difficulty,
            "solutionSteps": 20 + level_id,
            "solutionPushes": 2,
        },
    }


def generate(count: int) -> list[dict]:
    levels = [make_template_level(level_id) for level_id in range(1, count + 1)]
    for level in levels:
        solution = solve(level)
        if not solution["solved"]:
            raise RuntimeError(f"generated level {level['id']} is not solvable")
        level["meta"]["solutionSteps"] = solution["steps"]
        level["meta"]["solutionPushes"] = solution["pushes"]
    return levels


def verify(path: Path) -> int:
    levels = json.loads(path.read_text())
    failures = 0

    for level in levels:
        solution = solve(level)
        without_pushes = solve(level, allow_pushes=False)
        needs_stone = bool(level["objects"]["stones"]) and bool(level["objects"]["lasers"])
        quality_fail = needs_stone and without_pushes["solved"]

        if not solution["solved"] or quality_fail:
            failures += 1
            print(
                f"Level {level['id']}: solved={solution['solved']} "
                f"steps={solution['steps']} pushes={solution['pushes']} "
                f"without_pushes={without_pushes['solved']}"
            )
            continue

        print(
            f"Level {level['id']}: ok, steps={solution['steps']}, pushes={solution['pushes']}, "
            f"without_pushes={without_pushes['solved']}"
        )

    return failures


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=20, help="number of template levels to generate")
    parser.add_argument("--output", type=Path, help="write generated levels to a JSON file")
    parser.add_argument("--verify", type=Path, help="verify an existing levels.json file")
    args = parser.parse_args()

    if args.verify:
        return 1 if verify(args.verify) else 0

    levels = generate(args.count)
    payload = json.dumps(levels, indent=2)
    if args.output:
        args.output.write_text(payload + "\n")
    else:
        print(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
