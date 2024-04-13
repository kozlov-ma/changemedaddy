package main

import (
	"log/slog"
	"net/http"
	"os"

	charmlog "github.com/charmbracelet/log"
	"github.com/go-chi/chi/v5"

	"changemedaddy/internal/app/position"
	posinmem "changemedaddy/internal/app/position/db/inmem"
	"changemedaddy/internal/app/update"
	updinmem "changemedaddy/internal/app/update/db/inmem"
)

func main() {
	handler := charmlog.New(os.Stderr)
	log := slog.New(handler)

	posRepo := posinmem.NewRepository()
	posSvc := position.NewService(log, posRepo)
	posHandler := position.NewHandler(posSvc, log)

	updRepo := updinmem.NewRepository()
	updSvc := update.NewService(log, updRepo, posSvc)
	updHandler := update.NewHandler(updSvc, posSvc, log)

	r := chi.NewRouter()

	r.Mount("/api/v1/position", posHandler.Router())
	r.Mount("/api/v1/updates", updHandler.Router())

	http.ListenAndServe(":80", r)
}
