package update

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/render"
	slogchi "github.com/samber/slog-chi"
	"github.com/shopspring/decimal"

	"changemedaddy/internal/app/position"
	"changemedaddy/internal/pkg/api"
)

type service interface {
	Create(ctx context.Context, u *Update) (*Update, error)
	FindByPosition(ctx context.Context, pos *position.Position) ([]*Update, error)
	UpdatePosition(ctx context.Context, pos *position.Position, u *Update) (*position.Position, error)
}

type positionService interface {
	FindByID(ctx context.Context, id string) (*position.Position, error)
}

type Handler struct {
	srv    service
	posSrv positionService
	log    *slog.Logger
}

func NewHandler(srv service, posSrv positionService, log *slog.Logger) *Handler {
	return &Handler{
		srv:    srv,
		posSrv: posSrv,
		log:    log.With("handler", "update"),
	}
}

func (h *Handler) Router() chi.Router {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.Recoverer)
	r.Use(slogchi.New(h.log))
	r.Use(render.SetContentType(render.ContentTypeJSON))
	r.Use(h.positionCtx)

	r.Route("/{positionID}", func(r chi.Router) {
		r.With(h.positionCtx).Get("/", h.List)
		r.With(h.positionCtx).Post("/", h.Create)
	})

	return r
}

type updateCreateRequest struct {
	Type string `json:"type"`

	Delta int `json:"delta"`

	Price decimal.Decimal `json:"price"`

	NewDeadlineString string    `json:"newDeadline"`
	NewDeadline       time.Time `json:"-"`

	NewTargetPrice decimal.Decimal `json:"newTargetPrice"`
}

func (u *updateCreateRequest) Bind(r *http.Request) error {
	if u == nil {
		return errors.New("missing required updateCreateRequest fields")
	}

	switch Type(u.Type) {
	case TypeTx:
		if u.Delta == 0 {
			return errors.New("missing required delta field")
		}
		if !u.Price.IsPositive() {
			return errors.New("missing required price field")
		}
	case TypeDeadline:
		dl, err := time.Parse(position.TimeLayout, u.NewDeadlineString)
		if err != nil {
			return errors.Join(errors.New("missing required newDeadline field or it is in the wrong format"), err)
		}
		u.NewDeadline = dl
	case TypeTarget:
		if !u.NewTargetPrice.IsPositive() {
			return errors.New("missing required newTargetPrice field")
		}
	default:
		return errors.New("unknown update type")
	}

	return nil
}

func (u *updateCreateRequest) ToUpdate() *Update {
	return &Update{
		Type:           Type(u.Type),
		Delta:          u.Delta,
		Price:          u.Price,
		NewDeadline:    u.NewDeadline,
		NewTargetPrice: u.NewTargetPrice,
	}
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	pos := r.Context().Value(positionCtxKey).(*position.Position)

	u := new(updateCreateRequest)
	if err := render.Bind(r, u); err != nil {
		render.Render(w, r, api.ErrInvalidRequest(err))
		return
	}

	upd := u.ToUpdate()

	updated, err := h.srv.UpdatePosition(r.Context(), pos, upd)
	if err != nil {
		h.log.Error("update error", "error", err, "id", r.Context().Value(middleware.RequestIDKey))
		render.Render(w, r, api.ErrService(err))
		return
	}

	if err := render.Render(w, r, updated); err != nil {
		h.log.Error("render error", "error", err, "id", r.Context().Value(middleware.RequestIDKey))
		render.Render(w, r, api.ErrRender(err))
	}
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	pos := r.Context().Value(positionCtxKey).(*position.Position)

	updates, err := h.srv.FindByPosition(r.Context(), pos)
	if err != nil {
		h.log.Error("find updates error", "error", err, "id", r.Context().Value(middleware.RequestIDKey))
		render.Render(w, r, api.ErrService(err))
		return
	}

	res := make([]render.Renderer, len(updates))
	for i, u := range updates {
		res[i] = u
	}

	if err := render.RenderList(w, r, res); err != nil {
		h.log.Error("render error", "error", err, "id", r.Context().Value(middleware.RequestIDKey))
		render.Render(w, r, api.ErrRender(err))
	}
}

type ctxKey string

const positionCtxKey ctxKey = "position"

func (h *Handler) positionCtx(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var pos *position.Position

		if positionID := chi.URLParam(r, "positionID"); positionID != "" {
			p, err := h.posSrv.FindByID(r.Context(), positionID)
			if err != nil {
				render.Render(w, r, api.ErrService(err))
				return
			}

			pos = p
		}

		if pos == nil {
			render.Render(w, r, api.ErrNotFound)
			return
		}

		ctx := context.WithValue(r.Context(), positionCtxKey, pos)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
