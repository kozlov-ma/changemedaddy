package api

import (
	"changemedaddy/internal/aggregate/analyst"
	"github.com/labstack/echo/v4"
)

func (h *handler) visitorsMW(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		a, _ := c.Get("analyst").(*analyst.Analyst)
		h.vr.Add(c.Request().Context(), a, c.RealIP())

		return next(c)
	}
}

func (h *handler) getVisitorsCount(c echo.Context) error {
	return c.JSON(200, h.vr.GetAll(c.Request().Context()))
}
