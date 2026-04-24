import { useEffect, useRef, useState } from "react";
import { createEmptyAssets, removeWhiteBackdrop, trimTransparentBounds, type LumberjackAssets } from "./game/engine";

export function useLumberjackAssets() {
  const assetsRef = useRef<LumberjackAssets>(createEmptyAssets());
  const [isStageReady, setIsStageReady] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const syncStageReady = () => {
      if (isCancelled) return;

      const { idle, prepare, chop, dead, tree, branch, grass } = assetsRef.current;
      const nextReady = idle.ready && prepare.ready && chop.ready && dead.ready && tree.ready && branch.ready && grass.ready;
      setIsStageReady((current) => (current === nextReady ? current : nextReady));
    };

    const loadTransparentSprite = (
      path: string,
      assign: (asset: LumberjackAssets, image: HTMLCanvasElement | HTMLImageElement) => void,
    ) => {
      const image = new Image();
      image.onload = () => {
        if (isCancelled) return;
        assign(assetsRef.current, removeWhiteBackdrop(image));
        syncStageReady();
      };
      image.src = path;
    };

    const loadImage = (path: string, assign: (asset: LumberjackAssets, image: HTMLImageElement) => void) => {
      const image = new Image();
      assign(assetsRef.current, image);
      image.onload = () => {
        if (isCancelled) return;
        assign(assetsRef.current, image);
        syncStageReady();
      };
      image.src = path;
    };

    loadTransparentSprite("/lumberjack_idle.png", (asset, image) => {
      asset.idle = { image, ready: true };
    });

    loadTransparentSprite("/lumberjack_prepare.png", (asset, image) => {
      asset.prepare = { image, ready: true };
    });

    loadTransparentSprite("/lumberjack_chop.png", (asset, image) => {
      asset.chop = { image, ready: true };
    });

    loadTransparentSprite("/dead.png", (asset, image) => {
      asset.dead = { image, ready: true };
    });

    loadImage("/lumberjack-trunk.svg", (asset, image) => {
      asset.tree = { image, ready: image.complete };
    });

    loadImage("/lumberjack-branch.svg", (asset, image) => {
      asset.branch = { image, ready: image.complete };
    });

    loadTransparentSprite("/grass.png", (asset, image) => {
      asset.grass = { image: trimTransparentBounds(image), ready: true };
    });

    const chipPaths = ["/chip_1.svg", "/chip_2.svg", "/chip_3.svg"];
    let loadedChipCount = 0;
    assetsRef.current.chips = {
      images: chipPaths.map((path) => {
        const chipImage = new Image();
        chipImage.onload = () => {
          if (isCancelled) return;
          loadedChipCount += 1;
          assetsRef.current.chips = {
            images: assetsRef.current.chips.images,
            ready: loadedChipCount === chipPaths.length,
          };
        };
        chipImage.src = path;
        return chipImage;
      }),
      ready: false,
    };

    syncStageReady();

    return () => {
      isCancelled = true;
    };
  }, []);

  return { assetsRef, isStageReady };
}
