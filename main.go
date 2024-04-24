package main

import (
	"changemedaddy/internal/domain/position"
	"changemedaddy/internal/pkg/slugger"
	"changemedaddy/internal/repository/idearepo"
	"changemedaddy/internal/service/analyst"
	"changemedaddy/internal/service/market"
	"changemedaddy/internal/usecase/idea"
	"context"
	"fmt"
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

	svc := idea.NewService(slugger.Slugger{}, idearepo.NewMongoRep(), market.NewFakeService(), analyst.NewFakeService(), log)
	svc.Create(context.WithValue(context.TODO(), "requestID", "228"), idea.CreateIdeaRequest{
		Name: "Магнит темка",
		Positions: []idea.CreatePositionRequest{
			{
				Ticker:      "MGNT",
				Type:        position.Long,
				StartPrice:  decimal.NewFromInt(7741),
				TargetPrice: decimal.NewFromInt(11000),
				IdeaPart:    100,
			},
		},
		Deadline: time.Now().Add(41 * 24 * time.Hour),
	})

	res, err := svc.Page(context.Background(), idea.FindRequest{
		CreatedBySlug: "cumming-soon",
		Slug:          "magnit-temka",
	})
	fmt.Print(res, err)
}
