package main

import (
	"changemedaddy/internal/api"
	"changemedaddy/internal/pkg/closer"
	"changemedaddy/internal/repository/analystrepo"
	"changemedaddy/internal/repository/idearepo"
	"changemedaddy/internal/repository/positionrepo"
	"changemedaddy/internal/repository/tokenrepo"
	"changemedaddy/internal/repository/visitorsrepo"
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

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const (
	srvAddr         = ":8080"
	shutdownTimeout = 5 * time.Second
)

const mongoString = "mongodb://localhost:27017/?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+2.2.4"

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
	visitorsRepo := visitorsrepo.NewInmem(ctx)
	mp := market.NewService(log)

	ar := analystrepo.NewMongo(ctx, client)

	tr := tokenrepo.NewMongo(ctx, client)
	as := tokenauth.New(log, ar, tr)

	var (
		mux = http.NewServeMux()
		// cert, _ = tls.LoadX509KeyPair("server.crt", "server.key")
		srv = &http.Server{
			Addr:    srvAddr,
			Handler: mux,
			// TLSConfig: &tls.Config{Certificates: []tls.Certificate{cert}},
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

	panic(api.NewHandler(posRepo, visitorsRepo, ideaRepo, mp, ar, as, log).MustEcho().StartServer(srv))
}
