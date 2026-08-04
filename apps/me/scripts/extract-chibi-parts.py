#!/usr/bin/env python3
"""Extract anatomical limb parts from finished chibi pose PNGs.

Skeleton-distance partition (not box crops). Identity stack of the parts
composites back to the source with max RGB diff 0. Joint discs add PixelOver-
style overlap for later bone rotation.

Usage (from apps/me):
  python3 scripts/extract-chibi-parts.py
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "chibi"
OUT = SRC / "parts"
PARTS = ["head", "torso", "arm_l", "arm_r", "leg_l", "leg_r"]

SKELETONS = {
    "standing": {
        "size": (307, 501),
        "bones": {
            "head": [(166, 30), (166, 140), (166, 252)],
            "torso": [(166, 258), (166, 310), (166, 368)],
            "arm_l": [(95, 278), (50, 325), (30, 370)],
            "arm_r": [(235, 278), (270, 325), (290, 370)],
            "leg_l": [(125, 378), (115, 430), (110, 488)],
            "leg_r": [(205, 378), (215, 430), (220, 488)],
        },
        "pivots": {
            "head": (166, 252),
            "torso": (166, 368),
            "arm_l": (95, 278),
            "arm_r": (235, 278),
            "leg_l": (125, 378),
            "leg_r": (205, 378),
        },
        "waist_y": 370,
        "neck_y": 255,
        "cx": 166,
        "head_half_w": 120,
    },
    "sitting": {
        "size": (524, 861),
        "bones": {
            "head": [(300, 40), (300, 200), (290, 340), (275, 450)],
            "torso": [(260, 460), (250, 510), (245, 560)],
            "arm_l": [(195, 460), (130, 400), (70, 350), (40, 400), (55, 490)],
            "arm_r": [(310, 480), (380, 520), (450, 540), (480, 560)],
            "leg_l": [(190, 570), (165, 680), (145, 780), (130, 840)],
            "leg_r": [(290, 575), (320, 690), (340, 790), (300, 845)],
        },
        "pivots": {
            "head": (275, 450),
            "torso": (245, 560),
            "arm_l": (195, 460),
            "arm_r": (310, 480),
            "leg_l": (190, 570),
            "leg_r": (290, 575),
        },
        "waist_y": 565,
        "neck_y": 455,
        "cx": 275,
        "head_half_w": 160,
    },
    "pointing": {
        "size": (473, 929),
        "bones": {
            "head": [(220, 40), (220, 200), (220, 370), (220, 430)],
            "torso": [(220, 445), (220, 530), (220, 630)],
            "arm_l": [(145, 470), (80, 540), (45, 600), (90, 650)],
            "arm_r": [(295, 470), (350, 540), (395, 610), (410, 670)],
            "leg_l": [(155, 650), (135, 775), (125, 895)],
            "leg_r": [(295, 650), (325, 775), (350, 895)],
        },
        "pivots": {
            "head": (220, 430),
            "torso": (220, 630),
            "arm_l": (145, 470),
            "arm_r": (295, 470),
            "leg_l": (155, 650),
            "leg_r": (295, 650),
        },
        "waist_y": 640,
        "neck_y": 435,
        "cx": 220,
        "head_half_w": 180,
    },
}


def dist_point_to_seg(
    px: float, py: float, ax: float, ay: float, bx: float, by: float
) -> float:
    abx, aby = bx - ax, by - ay
    apx, apy = px - ax, py - ay
    ab2 = abx * abx + aby * aby
    if ab2 < 1e-6:
        return math.hypot(apx, apy)
    t = max(0.0, min(1.0, (apx * abx + apy * aby) / ab2))
    return math.hypot(px - (ax + t * abx), py - (ay + t * aby))


def dist_to_poly(px: float, py: float, poly: list[tuple[int, int]]) -> float:
    best = 1e18
    for i in range(len(poly) - 1):
        d = dist_point_to_seg(
            px, py, poly[i][0], poly[i][1], poly[i + 1][0], poly[i + 1][1]
        )
        if d < best:
            best = d
    return best


def extract(pose_name: str, skel: dict) -> dict:
    im = Image.open(SRC / f"{pose_name}.png").convert("RGBA")
    assert im.size == tuple(skel["size"]), (im.size, skel["size"])
    arr = np.array(im)
    h, w = arr.shape[:2]
    alpha = arr[:, :, 3] > 40
    r = arr[:, :, 0].astype(np.int16)
    g = arr[:, :, 1].astype(np.int16)
    b = arr[:, :, 2].astype(np.int16)
    skin = alpha & (r > 140) & (g > 70) & (g < 190) & (b < 150) & (r > g)

    dist = {p: np.full((h, w), 1e9, dtype=np.float32) for p in PARTS}
    ys, xs = np.where(alpha)
    bones = skel["bones"]
    neck_y = skel["neck_y"]
    waist_y = skel["waist_y"]
    cx = skel["cx"]
    head_hw = skel["head_half_w"]

    for y, x in zip(ys, xs):
        for p, poly in bones.items():
            dist[p][y, x] = dist_to_poly(float(x), float(y), poly)

    for y, x in zip(ys, xs):
        d_arm = min(dist["arm_l"][y, x], dist["arm_r"][y, x])
        in_head_column = abs(x - cx) <= head_hw

        if y <= neck_y:
            if in_head_column and d_arm > 28:
                dist["head"][y, x] *= 0.22
                dist["torso"][y, x] *= 2.4
                dist["arm_l"][y, x] *= 2.2
                dist["arm_r"][y, x] *= 2.2
                if skin[y, x]:
                    dist["head"][y, x] *= 0.2
            elif d_arm <= 28:
                if dist["arm_l"][y, x] <= dist["arm_r"][y, x]:
                    dist["arm_l"][y, x] *= 0.35
                else:
                    dist["arm_r"][y, x] *= 0.35
                dist["head"][y, x] *= 1.8
            else:
                dist["head"][y, x] *= 0.55
        elif skin[y, x] and y < neck_y + 20 and in_head_column:
            dist["head"][y, x] *= 0.45

        if y >= waist_y:
            dist["leg_l"][y, x] *= 0.55
            dist["leg_r"][y, x] *= 0.55
            dist["head"][y, x] *= 3.0
            if abs(x - cx) < 55:
                dist["torso"][y, x] *= 0.9
            else:
                dist["torso"][y, x] *= 1.5

        if neck_y < y < waist_y:
            if abs(x - cx) < 48:
                dist["torso"][y, x] *= 0.42
                dist["arm_l"][y, x] *= 1.45
                dist["arm_r"][y, x] *= 1.45
            elif x < cx - 60:
                dist["arm_l"][y, x] *= 0.38
            elif x > cx + 60:
                dist["arm_r"][y, x] *= 0.38

    stack = np.stack([dist[p] for p in PARTS], axis=0)
    labels = np.argmin(stack, axis=0)
    labels = np.where(alpha, labels, -1)

    layers: dict[str, np.ndarray] = {}
    for i, p in enumerate(PARTS):
        layer = np.zeros_like(arr)
        m = labels == i
        layer[m] = arr[m]
        layers[p] = layer

    overlap_radius = {"standing": 16, "sitting": 22, "pointing": 22}[pose_name]
    joint_pairs = [
        ("head", "torso", skel["pivots"]["head"]),
        ("arm_l", "torso", skel["pivots"]["arm_l"]),
        ("arm_r", "torso", skel["pivots"]["arm_r"]),
        ("leg_l", "torso", skel["pivots"]["leg_l"]),
        ("leg_r", "torso", skel["pivots"]["leg_r"]),
    ]
    yy, xx = np.mgrid[0:h, 0:w]
    for a_name, b_name, (px, py) in joint_pairs:
        disc = alpha & (((xx - px) ** 2 + (yy - py) ** 2) <= overlap_radius**2)
        for name in (a_name, b_name):
            empty = layers[name][:, :, 3] == 0
            fill = disc & empty
            layers[name][fill] = arr[fill]

    out_dir = OUT / pose_name
    out_dir.mkdir(parents=True, exist_ok=True)
    for p in PARTS:
        Image.fromarray(layers[p], "RGBA").save(out_dir / f"{p}.png")

    comp = np.zeros_like(arr)
    for p in ["leg_l", "leg_r", "torso", "arm_l", "arm_r", "head"]:
        src = layers[p]
        m = src[:, :, 3] > 0
        comp[m] = src[m]
    both = (comp[:, :, 3] > 0) & alpha
    diff = np.abs(
        comp[:, :, :3].astype(np.int16) - arr[:, :, :3].astype(np.int16)
    ).max(axis=2)
    max_diff = int(diff[both].max()) if both.any() else -1
    miss = int((alpha & (comp[:, :, 3] == 0)).sum())

    cov = {p: int((layers[p][:, :, 3] > 0).sum()) for p in PARTS}
    print(f"{pose_name}: maxDiff={max_diff} miss={miss} cov={cov}")
    return {
        "canvasWidth": w,
        "canvasHeight": h,
        "pivots": {k: {"x": v[0], "y": v[1]} for k, v in skel["pivots"].items()},
        "coverage": cov,
        "maxDiff": max_diff,
        "miss": miss,
    }


def main() -> None:
    meta = {name: extract(name, skel) for name, skel in SKELETONS.items()}
    (OUT / "pivots.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(f"wrote {OUT / 'pivots.json'}")


if __name__ == "__main__":
    main()
