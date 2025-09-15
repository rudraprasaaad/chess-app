import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { logger } from "../../services/logger";

export class StockfishEngine {
  private stockfish: ChildProcessWithoutNullStreams;
  private isReady = false;
  private listeners: ((message: string) => void)[] = [];

  constructor() {
    const stockfishPath = require.resolve(
      "stockfish/src/stockfish-17.1-8e4d048.js"
    );

    this.stockfish = spawn("node", [stockfishPath]);

    this.initializeListeners();
  }

  private initializeListeners(): void {
    this.stockfish.stdout.on("data", (data: Buffer) => {
      const messages = data.toString().split("\n").filter(Boolean);
      for (const message of messages) {
        const trimmedMessage = message.trim();
        if (trimmedMessage.startsWith("uciok")) {
          this.isReady = true;
          logger.info("Stockfish engine is ready.");
        }
        this.listeners.forEach((listener) => listener(trimmedMessage));
      }
    });

    this.stockfish.stderr.on("data", (data: Buffer) => {
      logger.error(`Stockfish stderr: ${data.toString().trim()}`);
    });

    this.stockfish.on("close", (code) => {
      if (code !== 0) {
        logger.error(`Stockfish process exited with code ${code}`);
      }
    });

    this.send("uci");
  }

  private send(command: string): void {
    this.stockfish.stdin.write(`${command}\n`);
  }

  public findBestMove(fen: string, moveTime: number): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.isReady) {
        return setTimeout(() => {
          this.findBestMove(fen, moveTime).then(resolve).catch(reject);
        }, 500);
      }

      const onMessage = (message: string) => {
        if (message.startsWith("bestmove")) {
          const bestMove = message.split(" ")[1];
          // Clean up this specific listener
          this.listeners = this.listeners.filter((l) => l !== onMessage);
          resolve(bestMove);
        }
      };

      this.listeners.push(onMessage);

      this.send(`position fen ${fen}`);
      this.send(`go movetime ${moveTime}`);
    });
  }

  public quit(): void {
    this.send("quit");
  }
}
