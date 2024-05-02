package main

import (
	"changemedaddy/internal/aggregate/idea"
	"changemedaddy/internal/api"
	"changemedaddy/internal/repository/analystrepo"
	"changemedaddy/internal/repository/idearepo"
	"changemedaddy/internal/repository/positionrepo"
	"changemedaddy/internal/service/market"
	"context"
	"log/slog"
	"os"
)

func main() {
	posRepo := positionrepo.NewInMem()
	ideaRepo := idearepo.NewInMem()
	mp := market.NewFakeService()

	_, err := idea.New(context.Background(), ideaRepo, idea.CreationOptions{
		Name:       "MgntToTheMoon",
		AuthorName: "Михаил Козлов",
		SourceLink: "https://en.uncyclopedia.co",
	})
	if err != nil {
		panic(err)
	}

	ar := analystrepo.NewInmem()

	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		AddSource: true,
		Level:     slog.LevelDebug,
	})
	log := slog.New(handler)

	err = api.NewHandler(posRepo, ideaRepo, mp, ar, log).MustEcho().Start(":8080")
	panic(err)
}
