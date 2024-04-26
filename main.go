package main

import (
	"changemedaddy/internal/domain/position"
	"changemedaddy/internal/pkg/slugger"
	"changemedaddy/internal/repository/analystrepo"
	"changemedaddy/internal/repository/idearepo"
	uidea "changemedaddy/internal/service/idea"
	"changemedaddy/internal/service/market"
	"context"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/greatcloak/decimal"
)

func main() {
	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		AddSource: true,
		Level:     slog.LevelDebug,
	})
	log := slog.New(handler)

	svc := uidea.NewService(slugger.Slugger{}, idearepo.NewMongoRep(context.TODO()), market.NewFakeService(), analystrepo.NewFake(), log)
	idea, err := svc.Create(context.TODO(), uidea.CreateIdeaRequest{
		Name:          "Магнит Пацанский!!",
		CreatedBySlug: "cumming-soon",
		Positions: []uidea.CreatePositionRequest{
			{
				Ticker:      "MGNT",
				Type:        position.Long,
				StartPrice:  decimal.NewFromInt(7741),
				TargetPrice: decimal.NewFromInt(11000),
				IdeaPart:    100,
			},
		},
		Deadline:   time.Now().AddDate(0, 1, 10),
		SourceLink: "megaanalitik3000s.ex",
	})

	idear, err := svc.Page(context.TODO(), uidea.FindRequest{
		Slug:          idea.Slug,
		CreatedBySlug: idea.Analyst.Slug,
	})

	fmt.Println(idear, err)
}
