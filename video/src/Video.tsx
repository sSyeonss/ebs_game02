import React from "react";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { Draw } from "./scenes/Draw";
import { Entry } from "./scenes/Entry";
import { Intro } from "./scenes/Intro";
import { Opening } from "./scenes/Opening";
import { Outro } from "./scenes/Outro";
import { PengsooScene } from "./scenes/PengsooScene";
import { Topic } from "./scenes/Topic";
import { SCENES, TRANSITION } from "./theme";

const timing = linearTiming({ durationInFrames: TRANSITION });

export const Video: React.FC = () => (
  <TransitionSeries>
    <TransitionSeries.Sequence durationInFrames={SCENES.opening}>
      <Opening />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={timing} />
    <TransitionSeries.Sequence durationInFrames={SCENES.intro}>
      <Intro />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={timing} />
    <TransitionSeries.Sequence durationInFrames={SCENES.entry}>
      <Entry />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={timing} />
    <TransitionSeries.Sequence durationInFrames={SCENES.topic}>
      <Topic />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={timing} />
    <TransitionSeries.Sequence durationInFrames={SCENES.draw}>
      <Draw />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={timing} />
    <TransitionSeries.Sequence durationInFrames={SCENES.pengsoo}>
      <PengsooScene />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={timing} />
    <TransitionSeries.Sequence durationInFrames={SCENES.outro}>
      <Outro />
    </TransitionSeries.Sequence>
  </TransitionSeries>
);
