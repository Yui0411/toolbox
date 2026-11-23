import { Caveat, Dancing_Script } from "next/font/google";

export const dancingScript = Dancing_Script({ subsets: ["latin"], weight: "600" });
export const caveat = Caveat({ subsets: ["latin"], weight: "600" });

export const signatureFonts = [
  { name: "Script", font: dancingScript },
  { name: "Handwritten", font: caveat },
] as const;
