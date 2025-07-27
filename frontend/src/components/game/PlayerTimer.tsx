import { useGameStore } from "../../store/game";

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 10;

  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

const PlayerTime = ({ color }: { color: "white" | "black" }) => {
  const time = useGameStore((state) =>
    color === "white" ? state.whiteTimeLeft : state.blackTimeLeft
  );

  const isActive = useGameStore((state) => {
    const turn =
      state.currentGame?.fen.split(" ")[1] === (color === "white" ? "w" : "b");
    return turn && state.currentGame?.status === "ACTIVE";
  });

  return (
    <div
      className={`rounded p-2 flex items-center gap-2 ${
        isActive ? "bg-green-200" : "bg-gray-200"
      }`}
    >
      <span
        className={`font-bold ${
          color === "white" ? "text-black" : "text-gray-800"
        }`}
      >
        {color === "white" ? "♔" : "♚"}
      </span>
      <span
        className={`text-base font-mono ${
          time < 10 ? "text-red-600 font-semibold" : ""
        }`}
        aria-label={`${color} player time left`}
      >
        {formatTime(time)}
      </span>
    </div>
  );
};

export default PlayerTime;
