package main

import (
	"changemedaddy/api"
	"changemedaddy/db/inmem"
	"changemedaddy/db/mock"
)

func main() {
	db := inmem.New()
	api := api.API{
		IdeaProvider:     mock.NewRandIdeaGen(),
		IdeaSaver:        db,
		IdeaUpdater:      db,
		PositionUpdater:  db,
		PositionProvider: mock.NewRandPosGen(),
	}

	api.RunServer()
}
