package api

import (
	"changemedaddy/internal/domain/chart"
	"github.com/labstack/echo/v4"
	"net/http"
	"time"
)

func (h *handler) getChart(c echo.Context) error {
	ctx := c.Request().Context()

	ticker := c.Param("ticker")
	openedAt, err := time.Parse(chart.DateFormat, c.Param("openedAt"))
	if err != nil {
		_ = c.Render(http.StatusBadRequest, "chart.html", []chart.Candle{})
		return err
	}
	curTime, err := time.Parse(chart.DateFormat, c.Param("curTime"))
	if err != nil {
		_ = c.Render(http.StatusBadRequest, "chart.html", []chart.Candle{})
		return err
	}
	i, err := h.mp.Find(ctx, ticker)
	if err != nil {
		_ = c.Render(http.StatusBadRequest, "chart.html", []chart.Candle{})
		return err
	}
	interval, err := i.WithInterval(ctx, openedAt, curTime)
	if err != nil {
		_ = c.Render(http.StatusBadRequest, "chart.html", []chart.Candle{})
		return err
	}

	candles, err := h.mp.GetCandles(ctx, &interval)
	if err != nil {
		_ = c.Render(http.StatusBadRequest, "chart.html", []chart.Candle{})
		return err
	}
	return c.Render(http.StatusOK, "chart.html", candles)
}
