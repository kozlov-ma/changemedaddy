package web

import (
	"changemedaddy/server/core"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/render"
	slogchi "github.com/samber/slog-chi"
	"log/slog"
	"net/http"
	"time"
)

type Web struct {
	db     core.DB
	market core.MarketProvider
	log    *slog.Logger

	router chi.Router
}

func New(db core.DB, market core.MarketProvider, log *slog.Logger) *Web {
	log = log.With("package", "api")
	web := &Web{db: db, market: market, log: log}

	r := chi.NewRouter()

	logConfig := slogchi.Config{
		WithRequestID: true,
	}

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(slogchi.NewWithConfig(web.log, logConfig))
	r.Use(middleware.Timeout(4 * time.Second))
	r.Use(middleware.Heartbeat("ping"))

	r.Route("/position", func(r chi.Router) {
		r.Use(render.SetContentType(render.ContentTypeHTML))
		r.Get("/{id}", web.handleGetPage)
	})

	web.router = r

	return web
}

func (web *Web) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	web.router.ServeHTTP(w, r)
}

func (web *Web) Pattern() string {
	return "/"
}
