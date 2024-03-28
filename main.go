package main

import (
	"changemedaddy/api"
	"changemedaddy/db/inmem"
)

func main() {
	db := inmem.New()
	api := api.API{
		IdeaProvider:     db,
		IdeaSaver:        db,
		IdeaUpdater:      db,
		PositionUpdater:  db,
		PositionProvider: db,
	}

	api.RunServer()
}
