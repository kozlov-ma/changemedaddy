package api

import (
	"changemedaddy/internal/aggregate/idea"
	"changemedaddy/internal/domain/instrument"
	"changemedaddy/internal/domain/position"
	"context"
	"log/slog"

	"github.com/greatcloak/decimal"
	"github.com/labstack/echo/v4"
)

type (
	positionRepo interface {
		Save(ctx context.Context, p *position.Position) error
		Find(ctx context.Context, id int) (*position.Position, error)
		Update(ctx context.Context, p *position.Position) error
	}

	ideaRepo interface {
		Save(ctx context.Context, i *idea.Idea) error
		Find(ctx context.Context, id int) (*idea.Idea, error)
	}

	marketProvider interface {
		Find(ctx context.Context, ticker string) (*instrument.Instrument, error)
		Price(ctx context.Context, i *instrument.Instrument) (decimal.Decimal, error)
	}
)

type handler struct {
	pos positionRepo
	mp  marketProvider
	ir  ideaRepo
	log *slog.Logger
}

func (h *handler) MustEcho() *echo.Echo {
	e := echo.New()

	e.GET("/position/:id", h.getPosition)
	e.GET("/idea/:id", h.getIdea)

	return e
}

func NewHandler(pr positionRepo, ir ideaRepo, mp marketProvider, log *slog.Logger) *handler {
	return &handler{
		pos: pr,
		mp:  mp,
		ir:  ir,
		log: log,
	}
}
