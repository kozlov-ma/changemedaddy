package api

import (
	"github.com/labstack/echo/v4"
	"net/http"
	"time"
)

func (h *handler) getCandles(c echo.Context) error {
	const layout = "2006-01-02"
	ticker := c.Param("ticker")
	openedAt, err := time.Parse(layout, c.Param("openedAt"))
	if err != nil {
		_ = c.JSON(http.StatusBadRequest, nil)
		return err
	}
	curTime, err := time.Parse(layout, c.Param("curTime"))
	if err != nil {
		_ = c.JSON(http.StatusBadRequest, nil)
		return err
	}
	i, err := h.mp.Find(c.Request().Context(), ticker)
	if err != nil {
		_ = c.JSON(http.StatusBadRequest, nil)
		return err
	}
	interval, err := i.WithInterval(c.Request().Context(), openedAt, curTime)
	if err != nil {
		_ = c.JSON(http.StatusBadRequest, nil)
		return err
	}

	candles, err := h.mp.GetCandles(c.Request().Context(), &interval)
	if err != nil {
		_ = c.JSON(http.StatusBadRequest, nil)
		return err
	}

	return c.JSON(http.StatusOK, candles)
}
