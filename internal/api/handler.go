package api

import (
	"changemedaddy/internal/aggregate/analyst"
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
		FindByAnalystSlug(ctx context.Context, analystSLug string) ([]*idea.Idea, error)
		FindBySlug(ctx context.Context, analystSlug string, slug string) (*idea.Idea, error)
	}

	marketProvider interface {
		Find(ctx context.Context, ticker string) (*instrument.Instrument, error)
		Price(ctx context.Context, i *instrument.Instrument) (decimal.Decimal, error)
		GetCandles(ctx context.Context, i *instrument.WithInterval) ([]chart.Candle, error)
	}

	analystRepo interface {
		Save(ctx context.Context, a *analyst.Analyst) error
		FindBySlug(ctx context.Context, slug string) (*analyst.Analyst, error)
	}

	tokenAuthService interface {
		Auth(ctx context.Context, token string) (*analyst.Analyst, error)
	}

	visitorsRepo interface {
		Add(ctx context.Context, a *analyst.Analyst, ip string)
		GetAll(ctx context.Context) map[string]int
	}
)

type handler struct {
	pos positionRepo
	vr  visitorsRepo
	mp  marketProvider
	ir  ideaRepo
	ar  analystRepo
	as  tokenAuthService
	log *slog.Logger
}

func (h *handler) MustEcho() *echo.Echo {
	e := echo.New()
	e.Static("/static", "web/chart")

	e.Use(slogecho.New(h.log))
	e.Use(h.adminMW)
	ui.NewRenderer().Register(e)

	e.GET("/chart-data/:ticker/from/:openedAt/to/:deadline/interval/:interval", h.getChartData)

	e.GET("/token_auth/:token", h.tokenAuth)
	e.POST("/token_auth/:token", h.tokenAuth)

	ae := e.Group("/analyst", h.analystMiddleware, h.ownerMW)
	ae.GET("/:analystSlug", h.getAnalyst)
	ae.GET("/:analystSlug/idea/:ideaSlug", h.getIdea, h.ideaMW, h.visitorsMW)
	ae.GET("/:analystSlug/new_idea", h.ideaForm)
	ae.GET("/:analystSlug/idea/:ideaSlug/position/:positionID", h.getPosition, h.ideaMW, h.positionMW)

	ae.GET("/:analystSlug/idea/:ideaSlug/new_position", h.positionForm, h.onlyOwnerMW, h.ideaMW)
	ae.POST("/:analystSlug/idea", h.addIdea, h.onlyOwnerMW)
	ae.POST("/:analystSlug/idea/:ideaSlug/position", h.addPosition, h.onlyOwnerMW, h.ideaMW)
	ae.GET("/:analystSlug/idea/:ideaSlug/edit_position/:positionID", h.editPositionForm, h.onlyOwnerMW, h.ideaMW, h.positionMW)
	ae.PATCH("/:analystSlug/idea/:ideaSlug/position/:positionID", h.editPosition, h.onlyOwnerMW, h.ideaMW, h.positionMW)

	e.GET("/empty", func(c echo.Context) error { return c.NoContent(200) })

	e.GET("/400", func(c echo.Context) error { return ui.Render400(c) })
	e.GET("/401", func(c echo.Context) error { return ui.Render401(c) })
	e.GET("/404", func(c echo.Context) error { return ui.Render404(c) })
	e.GET("/500", func(c echo.Context) error { return ui.Render500(c) })
	e.GET("/wrongtoken", func(c echo.Context) error { return ui.RenderWrongToken(c) })

	e.GET("/analytics", h.getVisitorsCount, h.adminonlyMW)

	e.GET("/makeadmin/:password", h.makeAdmin)

	return e
}

func NewHandler(pr positionRepo, vr visitorsRepo, ir ideaRepo, mp marketProvider, ar analystRepo, as tokenAuthService, log *slog.Logger) *handler {
	return &handler{
		pos: pr,
		vr:  vr,
		mp:  mp,
		ir:  ir,
		ar:  ar,
		as:  as,
		log: log,
	}
}
