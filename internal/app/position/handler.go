package position

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"slices"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/render"
	"github.com/gosimple/slug"
	slogchi "github.com/samber/slog-chi"
	"github.com/shopspring/decimal"

	"changemedaddy/internal/pkg/api"
)

type service interface {
	FindByID(ctx context.Context, id string) (*Position, error)
	Create(ctx context.Context, p *Position) (*Position, error)
	Update(ctx context.Context, p *Position) (*Position, error)
}

type Handler struct {
	srv service
	log *slog.Logger
}

func NewHandler(srv service, log *slog.Logger) *Handler {
	return &Handler{
		srv: srv,
		log: log.With("handler", "position"),
	}
}

func (h *Handler) Router() chi.Router {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.Recoverer)
	r.Use(slogchi.New(h.log))
	r.Use(render.SetContentType(render.ContentTypeJSON))

	r.Route("/", func(r chi.Router) {
		r.With(h.positionCtx).Get("/{positionID}", h.FindByID)
		r.Post("/", h.Create)
	})

	return r
}

func (h *Handler) FindByID(w http.ResponseWriter, r *http.Request) {
	position := r.Context().Value(positionCtxKey).(*Position)

	if err := render.Render(w, r, position); err != nil {
		h.log.Error("render error", "error", err, "id", r.Context().Value(middleware.RequestIDKey))
		render.Render(w, r, api.ErrRender(err))
	}
}

type positionCreateRequest struct {
	CreatedByID    string          `json:"createdById"`
	Name           string          `json:"name"`
	Ticker         string          `json:"ticker"`
	Type           Type            `json:"type"`
	TargetPrice    decimal.Decimal `json:"targetPrice"`
	Lots           []Lot           `json:"lots"`
	DeadlineString string          `json:"deadline"`
	Deadline       time.Time       `json:"-"`
}

func (p *positionCreateRequest) Bind(r *http.Request) error {
	if p == nil {
		return errors.New("wrong request body")
	}

	if p.CreatedByID == "" {
		return errors.New("missing required field createdById")
	}

	if p.Name == "" {
		return errors.New("missing required field name")
	}

	if len(p.Ticker) < 1 || len(p.Ticker) > 5 {
		return errors.New("missing required field ticker or it was filled wrong")
	}

	if p.Type != TypeLong && p.Type != TypeShort {
		return errors.New("missing required field type or it was filled wrong")
	}

	if !p.TargetPrice.IsPositive() {
		return errors.New("missing required field targetPrice or it was filled wrong")
	}

	if len(p.Lots) == 0 {
		return errors.New("missing required field lots")
	}

	if dl, err := time.Parse(TimeLayout, p.DeadlineString); err != nil {
		return errors.New("missing required field deadline or filled incorrectly, format " + TimeLayout)
	} else {
		p.Deadline = dl
	}

	return nil
}

func (p *positionCreateRequest) Position() *Position {
	position := &Position{
		CreatedByID: p.CreatedByID,
		Slug:        slug.Make(p.Name),
		Ticker:      p.Ticker,
		Type:        p.Type,
		TargetPrice: p.TargetPrice,
		Lots:        slices.Clone(p.Lots),
		CreatedAt:   time.Now().Truncate(24 * time.Hour),
		Deadline:    p.Deadline,
	}

	return position

}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	data := &positionCreateRequest{}
	if err := render.Bind(r, data); err != nil {
		h.log.Debug("deserialization error", "error", err, "id", r.Context().Value(middleware.RequestIDKey))
		render.Render(w, r, api.ErrInvalidRequest(err))
		return
	}

	position := data.Position()
	position, err := h.srv.Create(r.Context(), position)
	if err != nil {
		h.log.Error("service error", "error", err, "id", r.Context().Value(middleware.RequestIDKey))
		render.Render(w, r, api.ErrService(err))
		return
	}

	if err := render.Render(w, r, position); err != nil {
		h.log.Error("render error", "error", err, "id", r.Context().Value(middleware.RequestIDKey))
		render.Render(w, r, api.ErrRender(err))
		return
	}
}

type ctxKey string

const positionCtxKey ctxKey = "position"

func (h *Handler) positionCtx(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var position *Position

		if positionID := chi.URLParam(r, "positionID"); positionID != "" {
			pos, err := h.srv.FindByID(r.Context(), positionID)
			if err != nil {
				render.Render(w, r, api.ErrService(err))
				return
			}
			if pos == nil {
				render.Render(w, r, api.ErrNotFound)
				return
			}

			position = pos
		}

		ctx := context.WithValue(r.Context(), positionCtxKey, position)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
