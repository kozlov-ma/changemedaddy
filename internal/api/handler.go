package api

import (
	"changemedaddy/internal/aggregate/idea"
	"changemedaddy/internal/domain/chart"
	"changemedaddy/internal/domain/instrument"
	"changemedaddy/internal/domain/position"
	"changemedaddy/internal/ui"
	"context"
	"log/slog"

	"github.com/greatcloak/decimal"
	"github.com/labstack/echo/v4"
	slogecho "github.com/samber/slog-echo"
)

type (
	positionRepo interface {
		Save(ctx context.Context, p *position.Position) error
		Find(ctx context.Context, id int) (*position.Position, error)
		Update(ctx context.Context, p *position.Position) error
	}

	ideaRepo interface {
		Save(ctx context.Context, i *idea.Idea) error
		Update(ctx context.Context, i *idea.Idea) error
		Find(ctx context.Context, id int) (*idea.Idea, error)
	}

	marketProvider interface {
		Find(ctx context.Context, ticker string) (*instrument.Instrument, error)
		Price(ctx context.Context, i *instrument.Instrument) (decimal.Decimal, error)
		GetCandles(ctx context.Context, i *instrument.WithInterval) ([]chart.Candle, error)
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
	e.Static("/static", "web/chart")

	e.Use(slogecho.New(h.log))
	ui.NewRenderer().Register(e)

	ie := e.Group("/idea", h.ideaMiddleware)
	ie.GET("/:ideaID", h.getIdea)
	ie.GET("/:ideaID/new_position", h.positionForm)
	ie.POST("/:ideaID/position", h.addPosition)
	e.GET("/position/:positionID", h.getPosition)

	e.GET("/chart/:ticker/from/:openedAt/to/:deadline", h.getChart)

	e.GET("/empty", func(c echo.Context) error { return c.NoContent(200) })

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
