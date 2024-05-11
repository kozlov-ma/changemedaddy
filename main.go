package main

import (
	"changemedaddy/internal/api"
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
		as.RegisterAs("test", "test analyst")
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
