import React from "react";
import { Composition } from "remotion";
import { FPS, TOTAL } from "./theme";
import { Video } from "./Video";

export const Root: React.FC = () => (
  <Composition id="Intro" component={Video} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />
);
