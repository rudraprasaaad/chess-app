import { useGameStore } from "../../store/game";

const MoveHistory = () => {
  const moves = useGameStore((state) => state.currentGame?.moveHistory || []);

  if (!moves.length) return null;

  const rows = [];

  for (let i = 0; i < moves.length; i += 2) {
    rows.push({
      moveNumber: Math.floor(i / 2) + 1,
      white: moves[i].san || "",
      black: moves[i + 1].san || "",
    });
  }

  return (
    <div className="bg-muted/20 rounded-lg p-2 shadow w-40">
      <h4 className="text-sm font-semibold mb-1">Move History</h4>
      <table className="text-xs w-full">
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx}>
              <td className="pr-1 text-right">{row.moveNumber}.</td>
              <td className="pr-1">{row.white}</td>
              <td>{row.black}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default MoveHistory;
