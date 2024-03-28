package main

import "changemedaddy/api"

func main() {
	api := api.API{
		IdeaProvider:     nil,
		IdeaSaver:        nil,
		IdeaUpdater:      nil,
		PositionUpdater:  nil,
		PositionProvider: nil,
	}

	api.RunServer()
}
