package server

import (
	"context"
	"log/slog"
	"net"
	"net/http"

	"github.com/charmbracelet/log"
	"github.com/go-chi/chi/v5"
	"go.uber.org/fx"
)

type Router interface {
	http.Handler
	Pattern() string
}

func NewServerMux(routes []Router) *chi.Mux {
	r := chi.NewRouter()

	for _, route := range routes {
		r.Mount(route.Pattern(), route)
	}

	return r
}

func New(mux *chi.Mux, log *slog.Logger) *http.Server {
	srv := &http.Server{Addr: ":80", Handler: mux}
	return srv
}

func Run(lc fx.Lifecycle, srv *http.Server) {
	lc.Append(fx.Hook{
		OnStart: func(ctx context.Context) error {
			ln, err := net.Listen("tcp", srv.Addr)
			if err != nil {
				return err
			}

			log.Info("Starting HTTP server", "addr", srv.Addr)
			go srv.Serve(ln)

			return nil
		},
		OnStop: func(ctx context.Context) error {
			log.Info("Shutting down HTTP server", "addr", srv.Addr)
			return srv.Shutdown(ctx)
		}})
}
