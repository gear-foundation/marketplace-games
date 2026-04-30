import chickenIdle from "./art/chicken/crops/chicken_idle.webp";
import chickenLayingEgg from "./art/chicken/crops/chicken_laying_egg.webp";
import chickenRelieved from "./art/chicken/crops/chicken_relieved.webp";
import chickenScaredLoop from "./art/chicken/crops/chicken_scared_loop.webp";
import chickenScaredStart from "./art/chicken/crops/chicken_scared_start.webp";
import chickenStolen from "./art/chicken/crops/chicken_stolen.webp";
import collectorBasket from "./art/collector/collector_basket.webp";
import backgroundBack from "./art/environment/back.webp";
import shelf from "./art/environment/shelf.webp";
import brokenEgg from "./art/broken-egg/trimmed/broken_egg.webp";
import eggFlyingLoop from "./art/egg/trimmed/egg_flying_loop.webp";
import eggHit from "./art/egg/trimmed/egg_hit.webp";
import eggMissExit from "./art/egg/trimmed/egg_miss_exit.webp";
import eggThrowStart from "./art/egg/trimmed/egg_throw_start.webp";
import fallingEggCenter from "./art/falling-egg/trimmed/egg_falling_center.webp";
import fallingEggLeft from "./art/falling-egg/trimmed/egg_falling_left.webp";
import fallingEggRight from "./art/falling-egg/trimmed/egg_falling_right.webp";
import farmerBasketFull from "./art/farmer/basket-fill/farmer_basket_full.webp";
import farmerBasketOne from "./art/farmer/basket-fill/farmer_basket_one.webp";
import farmerBasketTwo from "./art/farmer/basket-fill/farmer_basket_two.webp";
import farmerCatch from "./art/farmer/crops/farmer_catch.webp";
import farmerDeposit from "./art/farmer/crops/farmer_deposit.webp";
import farmerIdle from "./art/farmer/crops/farmer_idle.webp";
import farmerJump from "./art/farmer/crops/farmer_jump.webp";
import farmerLying from "./art/farmer/crops/farmer_lying.webp";
import farmerRecover from "./art/farmer/crops/farmer_recover.webp";
import farmerRun01 from "./art/farmer/crops/farmer_run_01_v1.webp";
import farmerRun02 from "./art/farmer/crops/farmer_run_02_v1.webp";
import farmerRun03 from "./art/farmer/crops/farmer_run_03_v1.webp";
import farmerRun04 from "./art/farmer/crops/farmer_run_04_v1.webp";
import farmerSlipFall from "./art/farmer/crops/farmer_slip_fall.webp";
import farmerThrow from "./art/farmer/crops/farmer_throw.webp";
import foxAppear from "./art/fox/crops/fox_appear.webp";
import foxCarryUp from "./art/fox/crops/fox_carry_up.webp";
import foxHit from "./art/fox/crops/fox_hit.webp";
import foxHover from "./art/fox/crops/fox_hover.webp";
import foxLickLips from "./art/fox/crops/fox_lick_lips.webp";
import foxRetreat from "./art/fox/crops/fox_retreat.webp";
import foxSteal from "./art/fox/crops/fox_steal.webp";

export const chickenAlignedAssets = {
  idle: chickenIdle,
  layingEgg: chickenLayingEgg,
  scaredStart: chickenScaredStart,
  scaredLoop: chickenScaredLoop,
  relieved: chickenRelieved,
  stolen: chickenStolen,
} as const;

export const thrownEggTrimmedAssets = {
  throwStart: eggThrowStart,
  flyingLoop: eggFlyingLoop,
  hit: eggHit,
  missExit: eggMissExit,
} as const;

export const fallingEggTrimmedAssets = {
  center: fallingEggCenter,
  left: fallingEggLeft,
  right: fallingEggRight,
} as const;

export const brokenEggTrimmedAssets = {
  broken: brokenEgg,
} as const;

export const environmentAssets = {
  back: backgroundBack,
  shelf,
} as const;

export const collectorAssets = {
  basket: collectorBasket,
} as const;

export const farmerAlignedAssets = {
  idle: farmerIdle,
  run01: farmerRun01,
  run02: farmerRun02,
  run03: farmerRun03,
  run04: farmerRun04,
  jump: farmerJump,
  catch: farmerCatch,
  deposit: farmerDeposit,
  throw: farmerThrow,
  slipFall: farmerSlipFall,
  lying: farmerLying,
  recover: farmerRecover,
} as const;

export const farmerBasketFillAssets = {
  one: farmerBasketOne,
  two: farmerBasketTwo,
  full: farmerBasketFull,
} as const;

export const foxAlignedAssets = {
  appear: foxAppear,
  lickLips: foxLickLips,
  hover: foxHover,
  steal: foxSteal,
  carryUp: foxCarryUp,
  hit: foxHit,
  retreat: foxRetreat,
} as const;

const gameAssetUrls = Array.from(
  new Set([
    ...Object.values(chickenAlignedAssets),
    ...Object.values(thrownEggTrimmedAssets),
    ...Object.values(fallingEggTrimmedAssets),
    ...Object.values(brokenEggTrimmedAssets),
    ...Object.values(environmentAssets),
    ...Object.values(collectorAssets),
    ...Object.values(farmerAlignedAssets),
    ...Object.values(farmerBasketFillAssets),
    ...Object.values(foxAlignedAssets),
  ]),
);

const preloadedAssetImages = new Map<string, HTMLImageElement>();
let preloadGameAssetsPromise: Promise<void> | null = null;

export function getPreloadedAssetImage(src: string) {
  return preloadedAssetImages.get(src) ?? null;
}

export function preloadGameAssets(onProgress?: (loaded: number, total: number) => void) {
  const total = gameAssetUrls.length;
  onProgress?.(preloadedAssetImages.size, total);

  if (typeof Image === "undefined" || total === 0) {
    return Promise.resolve();
  }

  if (preloadedAssetImages.size === total) {
    return Promise.resolve();
  }

  if (preloadGameAssetsPromise) {
    return preloadGameAssetsPromise;
  }

  let loaded = preloadedAssetImages.size;
  const pendingUrls = gameAssetUrls.filter((src) => !preloadedAssetImages.has(src));

  preloadGameAssetsPromise = Promise.all(
    pendingUrls.map(
      (src) =>
        new Promise<void>((resolve, reject) => {
          const image = new Image();
          image.decoding = "async";

          const markLoaded = () => {
            if (!preloadedAssetImages.has(src)) {
              preloadedAssetImages.set(src, image);
              loaded += 1;
              onProgress?.(loaded, total);
            }
            resolve();
          };

          image.onload = markLoaded;
          image.onerror = () => {
            reject(new Error(`Failed to preload image asset: ${src}`));
          };
          image.src = src;

          if (image.complete && image.naturalWidth > 0) {
            markLoaded();
          }
        }),
    ),
  ).then(() => {
    onProgress?.(total, total);
  }).finally(() => {
    preloadGameAssetsPromise = null;
  });

  return preloadGameAssetsPromise;
}
