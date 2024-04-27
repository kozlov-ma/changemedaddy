package main

import (
	"changemedaddy/internal/aggregate/idea"
	"changemedaddy/internal/api"
	"changemedaddy/internal/domain/position"
	"changemedaddy/internal/repository/idearepo"
	"changemedaddy/internal/repository/positionrepo"
	"changemedaddy/internal/service/market"
	"context"
	"log/slog"
	"os"

	"github.com/greatcloak/decimal"
)

func main() {
	posRepo := positionrepo.NewInMem()
	ideaRepo := idearepo.NewInMem()
	mp := market.NewFakeService()

	p, err := position.New(context.Background(), mp, posRepo, position.CreationOptions{
		Ticker:      "MGNT",
		Type:        position.Long,
		TargetPrice: decimal.NewFromInt(11000),
		Deadline:    "2024-05-31",
		IdeaPartP:   decimal.NewFromInt(100),
	})

	if err != nil {
		panic(err)
	}

	_, err = idea.New(context.Background(), ideaRepo, idea.CreationOptions{
		Name:        "MgntToTheMoon",
		AuthorName:  "Михаил Козлов",
		SourceLink:  "https://en.uncyclopedia.co",
		PositionIDs: []int{p.ID},
	})
	if err != nil {
		panic(err)
	}

	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		AddSource: true,
		Level:     slog.LevelDebug,
	})
	log := slog.New(handler)

	err = api.NewHandler(posRepo, ideaRepo, mp, log).MustEcho().Start(":8080")
	panic(err)
}
