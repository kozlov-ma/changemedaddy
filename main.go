package main

import (
	"changemedaddy/internal/api"
	"changemedaddy/internal/repository/positionrepo"
	"changemedaddy/internal/service/market"
)

func main() {

	api.RunServer(positionrepo.NewInMem(), market.NewFakeService())

	// handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
	// 	AddSource: true,
	// 	Level:     slog.LevelDebug,
	// })
	// log := slog.New(handler)

	// svc := uidea.NewService(slugger.Slugger{}, idearepo.NewInMem(), market.NewFakeService(), analystrepo.NewFake(), log)
	// idea, err := svc.Save(context.TODO(), uidea.CreateIdeaRequest{
	// 	Name:          "Магнит Пацанский!!",
	// 	CreatedBySlug: "cumming-soon",
	// 	Positions: []uidea.CreatePositionRequest{
	// 		{
	// 			Ticker:      "MGNT",
	// 			Type:        position.Long,
	// 			StartPrice:  decimal.NewFromInt(7741),
	// 			TargetPrice: decimal.NewFromInt(11000),
	// 			IdeaPart:    100,
	// 		},
	// 	},
	// 	Deadline:   time.Now().AddDate(0, 1, 10),
	// 	SourceLink: "megaanalitik3000s.ex",
	// })

	// idear, err := svc.Page(context.TODO(), uidea.FindRequest{
	// 	Slug:          idea.Slug,
	// 	CreatedBySlug: idea.Analyst.Slug,
	// })

	// fmt.Println(idear, err)
}
