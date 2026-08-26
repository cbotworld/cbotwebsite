import { LiveStreamWatermark } from "expo-live-stream";

type Props = {
  day: string;
};

export function StreamOverlay({ day }: Props) {
  return (
    <LiveStreamWatermark
      text={day}
      position="bottom-left"
      opacity={1}
      margin={12}
      textStyle={{
        color: "#FFFFFF",
        fontSize: 22,
        fontWeight: "bold",
        textShadowColor: "rgba(0,0,0,0.8)",
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 4,
      }}
    />
  );
}
