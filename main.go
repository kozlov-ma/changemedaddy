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
)

const (
	srvAddr         = ":8080"
	shutdownTimeout = 5 * time.Second
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	handler := slog.NewJSONHandler(os.Stderr, &slog.HandlerOptions{
		AddSource: true,
		Level:     slog.LevelDebug,
	})
	log := slog.New(handler)

	posRepo := positionrepo.NewInMem()
	ideaRepo := idearepo.NewInMem()
	mp := market.NewService(log)

	ar := analystrepo.NewInmem()

	as := tokenauth.NewFake(ar)

	// generate some fake data
	func() {
		as.RegisterAs("mk0101", "MK")

		an, err := as.Auth(ctx, "mk0101")
		if err != nil {
			panic(err)
		}

		i, err := an.NewIdea(ctx, ideaRepo, analyst.IdeaCreationOptions{
			Name: "Магнит по 11к",
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
		if err := p.Save(ctx, posRepo); err != nil {
			panic(err)
		}

		as.RegisterAs("test", "test analyst")
		as.RegisterAs("shemet-no-lifer", "Павел Шеметов")
		as.RegisterAs("d1sturm", "Иван Домашних")
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

	go func() {
		if err := api.NewHandler(posRepo, ideaRepo, mp, ar, as, log).MustEcho().StartServer(srv); err != nil {
			log.Info(
				"stop listen and serve",
				"status", err,
			)
		}
	}()

	<-ctx.Done()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()

	if err := c.Close(shutdownCtx); err != nil {
		fmt.Printf("closer: %v", err)
	}
}
