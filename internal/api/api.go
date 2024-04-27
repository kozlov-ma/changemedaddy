package api

import (
	"changemedaddy/internal/domain/instrument"
	"changemedaddy/internal/domain/position"
	"changemedaddy/internal/pkg/template"
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
	e := echo.New()

	e.Renderer = template.New("web/templates/*.html")

	e.Static("/static", "web/static")

	h := handler{pos, mp}

	e.HTTPErrorHandler = func(err error, c echo.Context) {
		code := http.StatusInternalServerError
		if he, ok := err.(*echo.HTTPError); ok {
			code = he.Code
		}
		c.Logger().Error(err)
		c.String(code, "fuckin error")
	}

	e.GET("/position/:id", h.getPosition)
	e.POST("/position", h.createPosition)

	component := e.Group("/component")
	component.GET("/position_fields/:index", positionFields)

	e.GET("/new_idea", newIdea)

	e.Logger.Fatal(e.Start(":8080"))
}

func (h *handler) getPosition(c echo.Context) error {
	idS := c.Param("id")
	id, err := strconv.Atoi(idS)
	if err != nil {
		return c.NoContent(http.StatusNotFound)
	}
	p, err := h.pos.Find(c.Request().Context(), id)
	if errors.Is(err, position.ErrNotFound) {
		return c.Render(http.StatusNotFound, web.ErrorPageHTMLFilename, map[string]interface{}{
			"Header": "Позиция не найдена",
			"Error":  err,
		})
	} else if err != nil {
		return c.Render(http.StatusInternalServerError, web.ErrorPageHTMLFilename, map[string]interface{}{
			"Header": "Не можем получить позицию",
			"Error":  err,
		})
	}

	wp, err := p.WithProfit(c.Request().Context(), h.mp)
	if err != nil {
		return c.Render(http.StatusInternalServerError, web.ErrorPageHTMLFilename, map[string]interface{}{
			"Header": "Не можем получить цену позиции",
			"Error":  err,
		})
	}

	return c.Render(http.StatusOK, web.PageHTMLFilename, wp)
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

func positionFields(c echo.Context) error {
	idx, err := strconv.Atoi(c.Param("index"))
	if err != nil {
		return c.String(http.StatusBadRequest, "invalid index")
	}

	return c.Render(http.StatusOK, "position_fields.html", idx)
}

func newIdea(c echo.Context) error {
	return c.Render(http.StatusOK, "new_idea.html", nil)
}
