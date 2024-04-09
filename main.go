package main

import (
	"changemedaddy/db/inmem"
	"changemedaddy/market/fake"
	"changemedaddy/server"
	"changemedaddy/server/api"
	"changemedaddy/server/core"
	"changemedaddy/server/web"
	charmlog "github.com/charmbracelet/log"
	"go.uber.org/fx"
	"go.uber.org/fx/fxevent"
	"log/slog"
	"os"
)

func appLogger() *slog.Logger {
	handler := charmlog.New(os.Stderr)
	return slog.New(handler)
}

func asRouter(f any) any {
	return fx.Annotate(
		f,
		fx.As(new(server.Router)),
		fx.ResultTags(`group:"routers"`),
	)
}

func asDB(f any) any {
	return fx.Annotate(
		f,
		fx.As(new(core.DB)),
	)
}

func asMarketProvider(f any) any {
	return fx.Annotate(
		f,
		fx.As(new(core.MarketProvider)),
	)
}

func main() {
	fx.New(
		// Add logger
		fx.Provide(appLogger),
		fx.WithLogger(func(l *slog.Logger) fxevent.Logger {
			return &fxevent.SlogLogger{Logger: l}
		}),

		// Create database and market services
		fx.Provide(asDB(inmem.New)),
		fx.Provide(asMarketProvider(fake.NewMarket)),

		// Create routers for server
		fx.Provide(
			asRouter(api.New),
		),
		fx.Provide(
			asRouter(web.New),
		),

		// Create routing mux for server
		fx.Provide(
			fx.Annotate(
				server.NewServerMux,
				fx.ParamTags(`group:"routers"`),
			),
		),
		// Create server
		fx.Provide(
			server.New,
		),

		// Start server
		fx.Invoke(
			server.Run,
		),
	).Run()
}
