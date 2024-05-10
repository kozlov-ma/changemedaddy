package main

import (
	"changemedaddy/internal/api"
	"changemedaddy/internal/repository/analystrepo"
	"changemedaddy/internal/repository/idearepo"
	"changemedaddy/internal/repository/positionrepo"
	"changemedaddy/internal/service/auth"
	"changemedaddy/internal/service/market"
	"log/slog"
	"os"
)

func main() {
	posRepo := positionrepo.NewInMem()
	ideaRepo := idearepo.NewInMem()
	mp := market.NewFakeService()

	ar := analystrepo.NewInmem()

	handler := slog.NewJSONHandler(os.Stderr, &slog.HandlerOptions{
		AddSource: true,
		Level:     slog.LevelDebug,
	})
	log := slog.New(handler)

	as := auth.NewFake()

	err := api.NewHandler(posRepo, ideaRepo, mp, ar, as, log).MustEcho().Start(":8080")
	panic(err)
}
