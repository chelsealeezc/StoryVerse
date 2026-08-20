import type { TourSceneId } from "../../types/domain";

export interface TourCallbacks {
  tourActive: (scene: TourSceneId) => boolean;
  onTourFinish: (scene: TourSceneId) => void;
  onTourSkip: (scene: TourSceneId) => void;
}
