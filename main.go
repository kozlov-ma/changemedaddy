package main

import (
	"changemedaddy/internal/model"
	"changemedaddy/internal/pkg/slugger"
	"changemedaddy/internal/repository/idearepo"
	"changemedaddy/internal/service/idea"
	"context"
	"log/slog"
	"os"
	"time"

	"github.com/shopspring/decimal"
)

func main() {
	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		AddSource: true,
		Level:     slog.LevelDebug,
	})
	log := slog.New(handler)

	svc := idea.NewService(slugger.Slugger{}, idearepo.NewInMem(), log)
	svc.Create(context.WithValue(context.TODO(), "requestID", "228"), idea.CreateIdeaRequest{
		Name: "Магнит темка",
		Positions: []idea.CreatePositionRequest{
			{
				Ticker:      "MGNT",
				Type:        model.PositionLong,
				AvgPrice:    decimal.NewFromInt(7741),
				TargetPrice: decimal.NewFromInt(11000),
				IdeaPart:    100,
			},
		},
		Deadline: time.Now().Add(41 * 24 * time.Hour),
	})

	svc.FindOne(context.Background(), idea.FindRequest{
		ID:   313131,
		Slug: "",
	})
}
