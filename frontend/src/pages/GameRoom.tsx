import ChessBoard from "../components/game/ChessBoard";
import MoveHistory from "../components/game/MoveHistory";
import PlayerTimer from "../components/game/PlayerTimer";

export default function GameRoom() {
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start">
      <div>
        <PlayerTimer color="black" />
        <ChessBoard />
        <PlayerTimer color="white" />
      </div>
      <MoveHistory />
    </div>
  );
}
