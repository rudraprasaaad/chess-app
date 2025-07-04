import express from "express";

class Application{
	public app: express.Application;
	public server : any;

	constructor() {
		this.app = express();
	}
}

const app = new Application();

export default app;