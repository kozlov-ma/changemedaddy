package api

import (
	"changemedaddy/internal/aggregate/analyst"
	"changemedaddy/internal/ui"
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"
)

func (h *handler) authMW(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		an, err := h.ar.Find(c.Request().Context(), 0)
		if errors.Is(err, analyst.ErrNotFound) {
			c.Redirect(http.StatusFound, "/register") // todo in future must be login
			return nil
		} else if err != nil {
			h.log.Error("failed to find analyst", "err", err)
			return ui.Render500(c)
		}

		c.Set("user", an)
		return next(c)
	}
}
