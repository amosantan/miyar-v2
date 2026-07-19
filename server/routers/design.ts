import { mergeRouters } from "../_core/trpc";
import { designAssetsRouter } from "./design-assets";
import { designBriefsRouter } from "./design-briefs";
import { designBoardsRouter } from "./design-boards";
import { designCollaborationRouter } from "./design-collaboration";
import { designMarketContextRouter } from "./design-market-context";
import { designMaterialsRouter } from "./design-materials";
import { designSharingRouter } from "./design-sharing";
import { designVisualsRouter } from "./design-visuals";
import { designGeometryAssetsRouter } from "./design-geometry-assets";

/** Flat compatibility router: public procedure names remain design.*. */
export const designRouter = mergeRouters(
  designAssetsRouter,
  designBriefsRouter,
  designBoardsRouter,
  designCollaborationRouter,
  designMarketContextRouter,
  designMaterialsRouter,
  designSharingRouter,
  designVisualsRouter,
  designGeometryAssetsRouter
);
