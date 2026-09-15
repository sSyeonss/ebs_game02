import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// 앱(src/app/globals.css)과 같은 색·글꼴
export const C = {
  wall: "#f1e6cf",
  wallStripe: "#eadcc0",
  wood: "#a8733f",
  woodLight: "#c48f57",
  woodDark: "#6f4521",
  board: "#2f5140",
  boardDark: "#223d30",
  chalk: "#f5f3ea",
  chalkDim: "rgba(245, 243, 234, 0.72)",
  paper: "#fffdf5",
  paperLine: "#d6e4f3",
  margin: "#f0a8a8",
  ink: "#2e2a25",
  inkSoft: "#6b6258",
  red: "#e2574c",
  yellow: "#ffd54f",
  green: "#5bab5b",
  blue: "#4a90d9",
};

export const F = {
  title: '"Jua", "Malgun Gothic", sans-serif',
  hand: '"Gaegu", "Malgun Gothic", sans-serif',
  chalk: '"Nanum Pen Script", "Gaegu", "Malgun Gothic", cursive',
};

loadFont({ family: "Jua", url: staticFile("fonts/Jua-Regular.ttf") });
loadFont({ family: "Gaegu", url: staticFile("fonts/Gaegu-Regular.ttf"), weight: "400" });
loadFont({ family: "Gaegu", url: staticFile("fonts/Gaegu-Bold.ttf"), weight: "700" });
loadFont({ family: "Nanum Pen Script", url: staticFile("fonts/NanumPenScript-Regular.ttf") });

export const FPS = 30;
export const TRANSITION = 15;

// 장면 길이(프레임). 전환 6번 × 15프레임이 겹쳐서 총 1200프레임 = 40초
export const SCENES = {
  opening: 165,
  intro: 165,
  entry: 165,
  topic: 195,
  draw: 255,
  pengsoo: 195,
  outro: 150,
};

export const TOTAL =
  Object.values(SCENES).reduce((a, b) => a + b, 0) - (Object.keys(SCENES).length - 1) * TRANSITION;
