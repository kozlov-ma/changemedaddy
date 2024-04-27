package api

import (
	"changemedaddy/internal/domain/instrument"
	"changemedaddy/internal/domain/position"
	"changemedaddy/internal/web"
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/greatcloak/decimal"
	"github.com/labstack/echo/v4"
)

type (
	positionRepo interface {
		Save(ctx context.Context, p *position.Position) error
		Find(ctx context.Context, id int) (*position.Position, error)
		Update(ctx context.Context, p *position.Position) error
	}

	marketProvider interface {
		Find(ctx context.Context, ticker string) (*instrument.Instrument, error)
		Price(ctx context.Context, i *instrument.Instrument) (decimal.Decimal, error)
	}
)

type handler struct {
	pos positionRepo
	mp  marketProvider
}

func RunServer(pos positionRepo, mp marketProvider) {
	r := echo.New()

	tmpl := web.NewTmpls()
	r.Renderer = tmpl
	r.Static("/static", "web/static")

	h := handler{pos, mp}

	r.GET("/position/:id", h.getPosition)
	r.POST("/position", h.createPosition)

	r.Logger.Fatal(r.Start(":8080"))
}

func (h *handler) getPosition(c echo.Context) error {
	idS := c.Param("id")
	id, err := strconv.Atoi(idS)
	if err != nil {
		return c.NoContent(http.StatusNotFound)
	}
	p, err := h.pos.Find(c.Request().Context(), id)
	if errors.Is(err, position.ErrNotFound) {
		return echo.NewHTTPError(http.StatusNotFound, "position not found")
	} else if err != nil {
		return fmt.Errorf("couldn't get position: %w", err)
	}

	q, err := p.Quote(c.Request().Context(), h.mp)
	if err != nil {
		return fmt.Errorf("couldn't get quoted position: %w", err)
	}

	return c.Render(http.StatusOK, web.FilenamePageHTML, q)
}

func (h *handler) createPosition(c echo.Context) error {
	var opt position.PositionOptions
	if err := c.Bind(&opt); err != nil {
		return c.NoContent(http.StatusBadRequest)
	}

	pos, err := position.NewPosition(c.Request().Context(), h.mp, h.pos, opt)
	if err != nil {
		return fmt.Errorf("couldn't create position: %w", err)
	}

	return c.JSON(http.StatusCreated, pos)
}
