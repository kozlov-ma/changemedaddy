package main

import (
	"changemedaddy/internal/aggregate/analyst"
	"changemedaddy/internal/api"
	"changemedaddy/internal/domain/position"
	"changemedaddy/internal/pkg/closer"
	"changemedaddy/internal/repository/analystrepo"
	"changemedaddy/internal/repository/idearepo"
	"changemedaddy/internal/repository/positionrepo"
	"changemedaddy/internal/service/market"
	"changemedaddy/internal/service/tokenauth"
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/greatcloak/decimal"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const (
	srvAddr         = ":8080"
	shutdownTimeout = 5 * time.Second
)

const mongoString = "mongodb://127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+2.2.4"

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	handler := slog.NewJSONHandler(os.Stderr, &slog.HandlerOptions{
		AddSource: true,
		Level:     slog.LevelDebug,
	})
	log := slog.New(handler)

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(mongoString))
	if err != nil {
		panic(err)
	}

	posRepo := positionrepo.NewMongo(ctx, client)
	ideaRepo := idearepo.NewMongo(ctx, client)
	mp := market.NewService(log)

	ar := analystrepo.NewInmem()

	as := tokenauth.NewFake(ar)

	func() {
		as.RegisterAs("mk0101", "MK")

		as.RegisterAs("test", "test analyst")
		as.RegisterAs("shemet-no-lifer", "Павел Шеметов")
		as.RegisterAs("d1sturm", "Иван Домашних")
	}()

	fakeMeIdeas := func() {
		an, err := as.Auth(ctx, "mk0101")
		if err != nil {
			panic(err)
		}

		i, err := an.NewIdea(ctx, ideaRepo, analyst.IdeaCreationOptions{
			Name: "Магнит 🚀🌕",
		})
		if err != nil {
			panic(err)
		}

		p, err := i.NewPosition(ctx, mp, posRepo, ideaRepo, position.CreationOptions{
			Ticker:      "MGNT",
			Type:        position.Long,
			TargetPrice: "11000",
			Deadline:    "31.05.2024",
		})
		if err != nil {
			panic(err)
		}

		p.OpenDate = time.Date(2024, time.March, 10, 13, 31, 32, 0, time.Local)
		p.OpenPrice = decimal.NewFromInt(7841)
		if err := posRepo.Update(ctx, p); err != nil {
			panic(err)
		}
	}

	// generate some fake data
	func() {
		fakeMeIdeas()
	}()

	var (
		mux = http.NewServeMux()
		srv = &http.Server{
			Addr:    srvAddr,
			Handler: mux,
		}
		c = &closer.Closer{}
	)

	c.Add(mp.Shutdown)
	c.Add(srv.Shutdown)
	c.Add(func(ctx context.Context) error {
		return client.Disconnect(ctx)
	})

	go func() {
		<-ctx.Done()

		shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
		defer cancel()

		if err := c.Close(shutdownCtx); err != nil {
			fmt.Printf("closer: %v", err)
		}
	}()

	panic(api.NewHandler(posRepo, ideaRepo, mp, ar, as, log).MustEcho().StartServer(srv))
}
